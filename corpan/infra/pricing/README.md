# Affiliate / discount code pricing — diagnosis & fix plan (2026-06-19)

Intended offer for all partner codes (SKY30, IAN30, AUGUST30, AC30, FLO30,
MONICA30, DWALKER30, AGUS30): **30% off the first year**.

## What was wrong

Base annual prices differ per store: **Apple $99.99**, **Google $79.99** (USA).

- **Google** — every offer was set to `relativeDiscount: 0.70` = **70% off**
  (customer paid $24, should be $55.99). `relativeDiscount` is a true percentage
  applied to each region's local base, so a single value fixes every country.
  **Fix: set `relativeDiscount` 0.70 → 0.30 on all 8 offers** (Play Console, or
  API once the region-version patch issue is resolved). Verify via the Play
  monetization API afterward.

- **Apple** — offer codes are a **fixed price point per territory** (no percent
  option). Only the USA was correct ($69.99 = 30% off $99.99). In ~154/175
  territories the price was wrong — in low-price markets the "discount" code
  charged **more** than full price (Indonesia/Algeria/Egypt ~3×, India ~4.6×).
  Root cause: one price tier applied across territories; tier ratios are not
  constant per region.

## The Apple fix plan

`apple_offer_price_plan_30off.csv` — for each of the 175 territories: the base
price, the 30%-off target, and the **nearest Apple price point** (with its
`pricePointId`) plus the resulting discount %. Computed from each territory's
800-point ladder, so the result is within ±0.6pp of 30% everywhere (104 of 175
land exactly at 30.0%). The same plan applies to all 8 partner offer codes
(same subscription `corpan.sub.annual`, ASC id `6762317777`).

Columns: `territory, base, target30off, chosenPrice, discountPct, pricePointId`.

To apply: set each territory's offer-code price to `pricePointId`. NOTE: an
**active** offer code's prices may be immutable in App Store Connect — applying
the fix may require recreating the offer code, which changes the redeemable
custom-code string partners distribute. Confirm per code before applying.

## Verify / regenerate

Read live offer + price data with the App Store Connect API
(`appStoreConnect.{keyId,issuerId,p8}`) and the Play monetization API
(`google.serviceAccountJson`), both in Secrets Manager `corpan/content-packs/verify`.
