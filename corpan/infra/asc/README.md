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
| **Discount affiliate code** (your custom string) | `code-discount` | `POST /v1/subscriptionOfferCodes` + `POST /v1/subscriptionOfferCodeCustomCodes` |

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

# 5. A reusable affiliate discount code
python asc_monetization.py code-discount --product corpan.sub.annual \
       --code LAUNCH50 --percent-off 50 --periods 3 --max-uses 5000 --yes
```

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
2. **Offer-code price points.** Offer codes reference real `subscriptionPricePoints`
   per territory. `_resolve_price_points` picks the **highest (base) price point** per
   territory as the anchor; for `code-discount` the realized discount is whatever
   price point you bind, **not a literal `--percent-off`** (Apple has no raw-percent
   field here). To realize "~N% off", use `pricepoints` to find the point closest to
   `base*(1-percent/100)` and pass `--price-point <id>` (single-territory). Verify
   how `PAY_AS_YOU_GO` + the bound price point renders to the customer.
3. **`customerEligibilities` / `offerEligibility`** defaults (free → `[NEW, EXPIRED]`
   `STACK_WITH_INTRO_OFFERS`; discount → all three) match the marketing intent.
4. **JWT claim shape** assumes a **team** (Issuer-ID) key. An *individual* API key
   needs `sub: "user"` instead of `iss` — see the note in `_make_jwt`.
5. **`expirationDate` format** — the tool sends `YYYY-MM-DD`; Apple rejects timestamps
   with milliseconds (<https://developer.apple.com/forums/thread/731643>).

## Reference

- App Store Connect API: <https://developer.apple.com/documentation/appstoreconnectapi>
- Generating JWTs: <https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests>
- Subscription Introductory Offers: <https://developer.apple.com/documentation/appstoreconnectapi/subscription-introductory-offers>
- Subscription Offer Codes: <https://developer.apple.com/documentation/appstoreconnectapi/subscription-offer-codes>

## Google Play twin

The Android equivalent (free trials + the backward-compat flag) is
`../play/play_monetization.py`.
