# App Store Connect monetization tooling

Script Corpán's iOS subscription monetization (free trials, offer codes) via the
**App Store Connect API** — the Apple twin of `../play/play_monetization.py`.
Bundle id `com.corpora.corpan`; subscriptions `corpan.sub.monthly`, `corpan.sub.annual`.

## What's API-able

| Task | Command | Endpoint |
|---|---|---|
| See what's already configured | `list` | `GET /v1/apps?filter[bundleId]=…` → groups → subs → intro offers + offer codes |
| Inspect price points (need ids for paid offers) | `pricepoints` | `GET /v1/subscriptions/{id}/pricePoints?filter[territory]=USA` |
| **Free trial** (StoreKit *introductory offer*) | `trial` | `POST /v1/subscriptionIntroductoryOffers` (one per territory) |
| **Free promo codes** (one-time-use batch, CSV) | `code-free` | `POST /v1/subscriptionOfferCodes` + `POST /v1/subscriptionOfferCodeOneTimeUseCodes` |
| **% off affiliate code** (your custom string) | `code-discount` | `GET /v1/subscriptions/{id}/prices` + `…/pricePoints?filter[territory]=…` → `POST /v1/subscriptionOfferCodes` + `POST /v1/subscriptionOfferCodeCustomCodes` |
| **Regional per-territory prices** (from the pricing matrix) | `set-prices` | `…/pricePoints?filter[territory]=USA` (USD anchor) → `GET /v1/subscriptionPricePoints/{id}/equalizations` → `POST /v1/subscriptionPrices` (one per territory) |

Free trials apply automatically to eligible (never-/expired-subscriber) users — StoreKit
renders "7 days free, then $X". Offer/promo codes redeem **through the App Store**
(one-time-use codes via the redeem sheet / App Store URL; custom codes are **in-app
redemption only**, via `presentOfferCodeRedeemSheet`).

## Setup

```bash
pip install pyjwt cryptography requests boto3
```

### Auth (ES256 JWT)
The tool signs a short-lived (≤20 min) ES256 JWT with an App Store Connect API `.p8`
private key and sends it as `Authorization: Bearer <jwt>` to
`https://api.appstoreconnect.apple.com/v1`. Get the key in **App Store Connect →
Users and Access → Integrations → App Store Connect API** (Key ID, Issuer ID, and a
one-time `.p8` download). The key's role must be **Admin / App Manager** to write
monetization. The `.p8` and the JWT are **never printed**.

### Creds resolution (first that applies)
1. **Flags:** `--key-file AuthKey_XXXX.p8 --key-id XXXX --issuer-id <uuid>` (pass all three).
2. **AWS Secrets Manager (default):** secret `corpan/content-packs/verify`
   (override `--secret-id` / `$ASC_SECRET_ID`), with a JSON key **`appStoreConnect`**:

   ```json
   {
     "appStoreConnect": {
       "keyId":    "ABCD1234EF",
       "issuerId": "57246542-96fe-1a63-e053-0824d011072a",
       "p8":       "-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----\n"
     }
   }
   ```

   This key **does not exist in the secret yet** — until you add it, every command
   exits with a message telling you to populate it. (Put the `.p8`'s full PEM text in
   `p8`, newlines escaped as `\n` if storing inline JSON.)

> The repo is **open source**: keyId/issuerId/p8 are NEVER hardcoded in the script —
> only read from Secrets Manager or the flags. `.gitignore` here excludes `*.p8` /
> `AuthKey_*` / `creds.json`.

## Run (writes are dry-run until `--yes`)

```bash
# 1. Read-only: discover product ids + what already exists
python asc_monetization.py list

# 2. Inspect price points for a territory (need ids for any PAID offer/code)
python asc_monetization.py pricepoints --product corpan.sub.monthly --territory USA

# 3. 7-day free trial on each sub (dry-run prints the exact body; then --yes)
python asc_monetization.py trial --product corpan.sub.monthly --days 7
python asc_monetization.py trial --product corpan.sub.monthly --days 7 --yes
python asc_monetization.py trial --product corpan.sub.annual  --days 7 --yes
# limit to specific territories:  --territories USA CAN GBR

# 4. 100 free one-month codes (writes <name>-codes.csv)
python asc_monetization.py code-free --product corpan.sub.annual --count 100 --months 1 --yes

# 5. A reusable affiliate code with a REAL % discount in every territory
#    "30% off for 12 months" on the MONTHLY sub: --months 1 (period length) --periods 12 (count)
python asc_monetization.py code-discount --product corpan.sub.monthly \
       --code IAN --percent-off 30 --months 1 --periods 12 --max-uses 5000 --yes
#    "30% off the first year" on the ANNUAL sub: --months 12 --periods 1
python asc_monetization.py code-discount --product corpan.sub.annual \
       --code IAN --percent-off 30 --months 12 --periods 1 --yes

# 6. Apply REGIONAL per-territory prices from the pricing matrix (dry-run, then --yes)
python asc_monetization.py set-prices --product corpan.sub.monthly --period monthly \
       --matrix ../pricing/pricing-matrix.json
python asc_monetization.py set-prices --product corpan.sub.annual  --period annual \
       --matrix ../pricing/pricing-matrix.json --yes
#    just a few territories: --only USA,IDN,IND     |   schedule it: --start-date 2026-07-01
#    apply to EVERYONE (not just new buyers): --no-preserve-existing  (an increase needs consent)
```

### How `set-prices` maps USD → local → nearest rung (the anchoring)

The frozen `pricing-matrix.json` carries USD-equivalent targets per tier
(`tiers[].ios.{monthly,annual}`) and an ISO-2 `countryTier` map. Apple sets a
subscription's recurring price by binding it to a **fixed price-point rung** per
territory — you can't send an arbitrary number — and each territory's rungs are in
**local currency**, so we need a USD→local bridge. We use **Apple's own
equalizations** rather than hand-rolled FX:

1. **Map** the matrix country (ISO-2) → ASC territory (ISO-3) via `ISO2_TO_ISO3`
   (`US→USA`, `ID→IDN`, `IN→IND`, …). Unmapped countries are listed + skipped.
2. **Anchor in USD**: USA price points are in USD, so pick the USA rung **nearest the
   tier's `ios.<period>` target** (`nearest_point`, prefers the highest rung ≤ target).
3. **Equalize**: `GET /v1/subscriptionPricePoints/{usaPointId}/equalizations` returns
   the **equivalent rung in every territory** — Apple has already applied its currency
   conversion + perceived-price rounding (the `.99` endings), so we never compute
   exchange rates. We take that territory's equalized rung directly (one equalizations
   call per *distinct* USD target, cached → a 175-territory run is a few lookups).
4. **Apply**: `POST /v1/subscriptionPrices` (one per territory) binding the rung.

**`preserveCurrentPrice` (= `--preserve-existing`, default ON):** current subscribers
**keep their existing price**; only **new purchases** get the new price. This is the
safe default and matches our intent (we mostly **decrease** in poorer markets). Apple
requires consent for **increases** that hit existing subscribers — pass
`--no-preserve-existing` only when you've handled that. We **only POST the targeted
territories** — untargeted territories are left untouched (never blanked). Per-territory
failures (sub in review / not sold there) **skip + log**, never abort. The matrix file
may not exist yet → a clean "matrix not found" exit. Dry-run prints the resolution
table (`territory: USD target → local rung`) + two real request bodies; `--yes` applies.

### How `code-discount` realizes a real percentage discount

Apple has **no raw "% off"** — a discount is always one of Apple's fixed
**price-point rungs** (~800 per currency). So `code-discount`, for **each
territory**:

1. reads the **current base price** (`GET /v1/subscriptions/{id}/prices?include=
   subscriptionPricePoint,territory`), then
2. reads that territory's **price-point ladder**
   (`GET /v1/subscriptions/{id}/pricePoints?filter[territory]=<T>`, paginated), and
3. binds the rung **nearest `(1 - percent/100) × base`** (prefer the highest rung
   ≤ target; else the globally nearest) as that territory's
   `subscriptionOfferCodePrice`.

This is an **approximation bounded by the ladder** (usually within a cent or two of
the exact percentage). Territories the sub isn't priced in are **skipped, not fatal**
(like `trial`). A dry-run prints the resolution table (`base → target → chosen point
+ actual −%`) and the request body with **real resolved price-point ids** for the
first few territories — verify USA before adding `--yes`.

**`--months` vs `--periods`** (`PAY_AS_YOU_GO`): `--months` is the **length of each
billing period**; `--periods` is **how many periods** the discount is charged.
"30% off 12 months" on a monthly sub = `--months 1 --periods 12`; "30% off the first
year" on an annual sub = `--months 12 --periods 1`. `customerEligibilities` defaults
to `NEW,EXISTING,EXPIRED` so affiliate codes work for everyone.
`--price-point <id>` is an explicit override, valid only with a single `--territories`.

`--days` / `--months` must map to an Apple **SubscriptionOfferDuration**
(`THREE_DAYS, ONE_WEEK, TWO_WEEKS, ONE_MONTH, TWO_MONTHS, THREE_MONTHS, SIX_MONTHS,
ONE_YEAR`) — there is no arbitrary "N days". One-time-use code batches expire ≤ 6 months out.

## Key request shapes (with the enum values the API accepts)

- **Intro offer** `POST /v1/subscriptionIntroductoryOffers` — `data.attributes`
  `{ duration, offerMode: FREE_TRIAL, numberOfPeriods, startDate?, endDate? }`;
  `relationships` `subscription` (required) + `territory` (+ `subscriptionPricePoint`
  only for paid modes). **Created one offer per territory** (see below).
- **Offer code** `POST /v1/subscriptionOfferCodes` — `attributes`
  `{ name, customerEligibilities: [NEW|EXISTING|EXPIRED], offerEligibility:
  STACK_WITH_INTRO_OFFERS|REPLACE_INTRO_OFFERS, offerMode:
  FREE_TRIAL|PAY_AS_YOU_GO|PAY_UP_FRONT, duration, numberOfPeriods }`; `relationships`
  `subscription` + `prices` (→ `subscriptionOfferCodePrices`), with an `included` array
  of `SubscriptionOfferCodePriceInlineCreate` wiring each territory to a
  `subscriptionPricePoint`.
- **One-time-use batch** `POST /v1/subscriptionOfferCodeOneTimeUseCodes` —
  `{ numberOfCodes, expirationDate }` + `offerCode` relationship; codes downloaded as
  CSV from `…/{id}/values`.
- **Custom code** `POST /v1/subscriptionOfferCodeCustomCodes` —
  `{ customCode, numberOfCodes, expirationDate? }` + `offerCode` relationship.

## Things to verify live (this tool was built correct-by-construction, never run)

The integrator has no Issuer ID yet, so nothing below has been exercised against the
real API. Verify and adjust:

1. **Intro-offer territory handling.** Apple intro offers are created **one POST per
   territory**: although the create request accepts an `included` price-point array,
   developers report it has "no effect" for batching across territories
   (<https://developer.apple.com/forums/thread/759596>). `trial` enumerates
   `/v1/territories` and POSTs one offer each. Confirm whether a single all-territory
   call has since been enabled (it would simplify this a lot).
2. **Offer-code price points.** `code-discount` now resolves a **real** per-territory
   discount: read base (`/prices`) → pick the rung nearest `base*(1-percent/100)` in
   that territory's ladder (`/pricePoints`) → bind it. Confirm against the live API
   that (a) `/subscriptions/{id}/prices` returns the current base via the *included*
   `subscriptionPricePoints[].attributes.customerPrice` keyed by the price's
   `territory` relationship (the shape this code reads), (b) the inline `included`
   `subscriptionOfferCodePrices` array DOES batch across territories for OFFER CODES
   (it's documented to, unlike intro offers), and (c) how `PAY_AS_YOU_GO` + the bound
   rung renders to the customer. `--price-point <id>` still overrides for a single
   territory. (`code-free` keeps `_resolve_price_points`, which anchors to the base
   rung — a FREE code derives $0 from offerMode, so the anchor choice is moot.)
3. **`customerEligibilities` / `offerEligibility`** defaults (free → `[NEW, EXPIRED]`
   `STACK_WITH_INTRO_OFFERS`; discount → all three) match the marketing intent.
4. **JWT claim shape** assumes a **team** (Issuer-ID) key. An *individual* API key
   needs `sub: "user"` instead of `iss` — see the note in `_make_jwt`.
5. **`expirationDate` format** — the tool sends `YYYY-MM-DD`; Apple rejects timestamps
   with milliseconds (<https://developer.apple.com/forums/thread/731643>).
6. **`set-prices` equalizations + create body.** Confirm against the live API that (a)
   `GET /v1/subscriptionPricePoints/{id}/equalizations?include=territory` returns the
   equivalent rung in every territory, each as a `subscriptionPricePoint` with
   `attributes.customerPrice` (local) and a `territory` relationship (the shape this
   code reads); (b) `POST /v1/subscriptionPrices` accepts the body
   `{data:{type:subscriptionPrices, attributes:{preserveCurrentPrice, startDate?},
   relationships:{subscription, territory, subscriptionPricePoint}}}` — **one POST per
   territory** (no all-territory batch, unlike offer codes); (c) the **subscription
   isn't "In Review"** — price changes are rejected mid-review
   (<https://developer.apple.com/forums/thread/773452>); (d) `preserveCurrentPrice:true`
   behaves as "current subs keep their price, new buyers get the new one." The
   equalizations result already encodes Apple's FX, so the USD→local mapping needs no
   exchange-rate config — but eyeball USA + one cheap market (e.g. IDN/IND) in the
   dry-run table before `--yes`.

## Reference

- App Store Connect API: <https://developer.apple.com/documentation/appstoreconnectapi>
- Generating JWTs: <https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests>
- Subscription Introductory Offers: <https://developer.apple.com/documentation/appstoreconnectapi/subscription-introductory-offers>
- Subscription Offer Codes: <https://developer.apple.com/documentation/appstoreconnectapi/subscription-offer-codes>
- Subscription price points (per-territory ladder): <https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-pricepoints>
- Subscription current prices: <https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-prices>
- Per-territory pricing + equalizations workflow: <https://developer.apple.com/forums/thread/718915>
- Create a subscription price change (`POST /v1/subscriptionPrices`): <https://developer.apple.com/documentation/appstoreconnectapi/post-v1-subscriptionprices>
- List subscription price-point equalizations: <https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptionpricepoints-_id_-equalizations>
- Confirmed `subscriptionPrices` create body (one POST per territory): <https://developer.apple.com/forums/thread/773452>
- Working pricePoints read example (`include=territory&filter[territory]=…`): <https://gist.github.com/astashov/79dd4ef4e91ea012710145623bfe0984>

## Google Play twin

The Android equivalent (free trials + the backward-compat flag) is
`../play/play_monetization.py`.
