# App Store Connect — subscription offers setup brief (for a browser agent)

Hand this to a Claude-for-Chrome / browser agent operating in **App Store Connect**
(https://appstoreconnect.apple.com), signed in to the Corpán account.

## App & products
- **App:** Corpán — bundle id `com.corpora.corpan`.
- **Subscriptions:** two auto-renewing products in one Subscription Group:
  - **Monthly** — product id likely `corpan.sub.monthly`
  - **Annual** — product id likely `corpan.sub.annual`
- **Agent: first confirm** the exact two product ids + the Subscription Group name under
  **Apps → Corpán → (left sidebar) Subscriptions** (older UI: **Monetization → Subscriptions**,
  or **Features → In-App Purchases / Subscriptions**). Everything below is done on BOTH products.

## Prerequisites to verify (don't skip)
- **Paid Apps agreement** is Active (Business → Agreements). Offers/codes can't go live otherwise.
- Both subscriptions have **pricing set** and are at least "Ready to Submit"/Approved.
- A **tax category** is set on each subscription.

---

## Deliverable 1 — 7-day FREE TRIAL (Introductory Offer) — both products
Apple calls a free trial an **Introductory Offer** of type *Free*. Apple's durations are
fixed; **"7 days" = choose "1 week."**

For EACH subscription (monthly, then annual):
1. Open the subscription → **Introductory Offers** (older UI: **Subscription Prices →
   Introductory Offer**) → **Create / Set Up Introductory Offer** (＋).
2. **Countries or Regions:** All.
3. **Start Date:** today. **End Date:** None (run ongoing).
4. **Offer Type:** **Free**.
5. **Duration:** **1 week**.  (Allowed: 3 days, 1 week, 2 weeks, 1 month, 2 months, 3
   months, 6 months, 1 year — pick 1 week.)
6. Save.
> Notes: an Introductory Offer applies to **new** subscribers and is granted **once per
> subscription group** per customer. Only one intro offer per subscription is active per
> region at a time.

---

## Deliverable 2 — ONE-TIME-USE FREE codes (Offer Codes, Free) — both products
For giveaways / reviewers / influencers you hand individual codes to.

For EACH subscription:
1. Open the subscription → **Offer Codes** → **Create Offer Code** (＋) (older UI:
   **Set Up Offer Codes**).
2. **Reference Name** (internal only): e.g. `Free 1-month — giveaways (monthly)`.
3. **Offer Type:** **Free**. **Duration:** the free period to gift — recommend **1 month**
   (adjust to taste; same duration menu as above).
4. **Eligible Customers:** New + Expired (so lapsed users can also redeem). Avoid
   "Existing/active" for a pure giveaway unless you want current subscribers to use them.
5. **Code Type:** **One-Time-Use Codes** → set **quantity** (up to **25,000** per batch;
   app cap is **1,000,000 redemptions/quarter**) → **Expiration Date** (≤ **6 months** out).
6. **Generate** → **download the CSV** of codes.
> These redeem in the App Store (apps.apple.com/redeem or App Store app → Redeem) AND
> in-app once our redeem sheet ships (Phase 3). They work via the App Store today.

---

## Deliverable 3 — AFFILIATE codes carrying a DISCOUNT (Offer Codes, Custom) — both products
One shareable string per affiliate/influencer/school; redemptions of that string =
that partner's attribution.

For EACH subscription, create one Offer Code **per affiliate** (or a few templates):
1. Open the subscription → **Offer Codes** → **Create Offer Code** (＋).
2. **Reference Name:** e.g. `Affiliate 50% off 3mo — JANE (monthly)`.
3. **Offer Type:** **Pay As You Go** — *discounted price each period for N periods*
   (e.g. **50% off for 3 months**). *(Alternative: **Pay Up Front** = one discounted price
   for a duration, e.g. a cheaper single charge for 1 year.)*
4. **Discount / Price:** set the per-period discounted price (App Store Connect shows a
   price-point picker per territory; pick the ~50%-off tier) and the **number of periods**.
5. **Eligible Customers:** New + Expired (add Existing only if you want current subscribers
   to switch to the discount).
6. **Code Type:** **Custom Codes** → enter the **custom code string** for that affiliate
   (e.g. `JANE50`) → **redemption limit** → **Expiration Date** (≤ 6 months).
7. Save. Repeat per affiliate with a unique string each.
> Each unique custom string is how we attribute revenue to that partner (the offer id +
> appAccountToken land in the receipt; our Phase 3 ledger records it). Keep a list of
> `code string → affiliate` somewhere (a sheet) so payouts can be reconciled.

---

## "All the things" checklist (the agent should end with)
- [ ] Monthly: Introductory Offer = Free, 1 week, all regions, ongoing.
- [ ] Annual: Introductory Offer = Free, 1 week, all regions, ongoing.
- [ ] Monthly: One-time-use FREE offer codes generated + CSV downloaded.
- [ ] Annual: One-time-use FREE offer codes generated + CSV downloaded.
- [ ] Monthly: at least one DISCOUNT custom offer code (per affiliate) created.
- [ ] Annual: at least one DISCOUNT custom offer code (per affiliate) created.
- [ ] Note the exact product ids + subscription group name back to the team.
- [ ] Save all CSVs + the `code → affiliate` mapping.

## Gotchas for the agent
- Offer code **expiration ≤ 6 months**; you re-generate batches periodically.
- A subscription must be approved/submittable before offers/codes can be created.
- Discounts shown *in-app* require our app to fetch + display them (Phase 3); but codes
  always redeem via the App Store redemption page regardless.
- Don't enable "Existing/active subscribers" eligibility on free giveaways unless intended.

## Alternative: we can script Apple too
App Store Connect has an **API** for all three of these
(`subscriptionIntroductoryOffers`, `subscriptionOfferCodes`,
`subscriptionOfferCodeOneTimeUseCodes`, `subscriptionOfferCodeCustomCodes`). If you'd
rather not browser-click, generate an **App Store Connect API key** (Users and Access →
Integrations → App Store Connect API → key with "App Manager" access) and hand it over —
we'll build an Apple equivalent of `infra/play/play_monetization.py`.
