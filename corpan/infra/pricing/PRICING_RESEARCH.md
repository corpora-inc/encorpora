# Corpán Regional Pricing — Research & Rationale

**Status:** Pricing strategy v1 · **Date:** 2026-06-14
**Owner of decision:** founder · **Consumed by:** the price-resolution tooling (reads `pricing-matrix.json`)

This document explains the tier definitions, country assignments, the iOS-vs-Android gap logic,
the Duolingo benchmark, and the FX/PPP reasoning behind `pricing-matrix.json`. The JSON is the
source of truth for the tools; this file is the "why".

---

## 1. Strategy in one paragraph

Corpán is **offline-first with recycled on-device inference** (LLM + STT run on the handset), so the
**marginal cost of an additional subscriber is ≈ $0** — serving 1,000,000 subscribers costs barely
more than serving 50. The economically correct move is therefore **not** a single global price but
**aggressive, localized willingness-to-pay capture**: hold a strong price at the top, and go *very*
cheap where incomes are low, because every incremental subscriber at $10/yr is almost pure margin and
also strengthens the network/brand. We anchor **at or slightly below Duolingo Super** in every market
(Duolingo can charge a brand+habit premium that a smaller app cannot), and we **split iOS vs Android**
to exploit the fact that, especially in poorer countries, the iPhone base is dramatically wealthier
than the Android base.

---

## 2. Benchmark — Duolingo Super (individual plan)

Verified reference prices (used to set our ceiling — we sit at or just under these):

| Market | Duolingo Super monthly | Duolingo Super annual |
|---|---|---|
| United States | $12.99 | $119.99 |
| United Kingdom | £10.99 (~$14) | £89.99 (~$114) |
| EU (base) | €7.33 | — |
| Spain | €7.99 | €122.99 |
| Canada | CA$12.99 | CA$149.99 (~$110) |
| Australia | AU$16.99 | AU$174.99 (~$116) |
| Brazil | R$19.90 (~$3.70) | R$149.90 (~$28) |
| India | ₹649 (~$7.70) | ₹3,999 (~$48) |
| Turkey | — | TRY 499.99 |

Sources: Papora "Super Duolingo prices 2026" and FamilyPro "Duolingo price in different countries"
(see §8). Note Duolingo's *individual annual* in PPP-discounted markets is materially cheaper than
the US sticker — the owner's supplied PPP cheap-annual cluster (USD-equiv/yr) is the better floor
reference for the bottom tiers:

> India ~$14 · Vietnam ~$24 · Turkey ~$24 · Thailand ~$26 · Indonesia ~$27 · Philippines ~$29 ·
> Brazil ~$35 · Egypt ~$36 · Saudi ~$57.

(The ~$76–$84/yr "cheapest country" figures floating around VPN blogs are a *different, higher* SKU /
the headline annual, not the deeply PPP-discounted local individual annual — we ignore them for the
floor.)

**Corpán positioning:** match-or-undercut. Our T1 iOS annual is **$99.99** (below Duolingo's
$119.99 US), and our bottom-tier annuals ($7–$15) sit **below** Duolingo's PPP annuals — deliberate,
because zero marginal cost lets us win on price in markets where a few dollars decides the purchase.

---

## 3. Income basis — World Bank FY2026 classification

Tiers are grounded in the World Bank GNI-per-capita (Atlas method) income groups (FY2026 thresholds):

- **High income:** GNI/capita > $13,935
- **Upper-middle income:** $4,496 – $13,935
- **Lower-middle income:** $1,136 – $4,495
- **Low income:** ≤ $1,135

Source: World Bank "Country and Lending Groups" + Our World in Data "World Bank income groups" (§8).
We subdivide High income into three tiers (T1–T3) and the rest into T4–T8, because raw GNI groups are
too coarse for pricing: Switzerland and Greece are both "high income" but tolerate very different price
points, and Nigeria vs Bangladesh (both lower-middle / low frontier) have very different iPhone bases.

---

## 4. The tiers (USD-equivalent targets)

| Tier | Label | Android mo | Android yr | iOS mo | iOS yr | # countries |
|---|---|---|---|---|---|---|
| **T1** | Top wealth (US, CH, NO, SG, AU, DK, IE, LU, QA, HK) | $9.99 | $79.99 | $12.99 | $99.99 | 12 |
| **T2** | High income core (GB, DE, FR, CA, JP, KR, NL, SE, AE, IL) | $8.99 | $69.99 | $10.99 | $84.99 | 15 |
| **T3** | High income peripheral + Gulf (ES, IT, PT, PL, CZ, SA, KW) | $6.99 | $54.99 | $8.99 | $67.99 | 18 |
| **T4** | Upper-middle wealthier (CL, MY, CN, RU, RO, HR, KZ) | $4.99 | $39.99 | $6.99 | $49.99 | 21 |
| **T5** | Upper-middle large emerging (BR, MX, TR, ZA, CO, TH, AR) | $3.49 | $27.99 | $4.99 | $35.99 | 25 |
| **T6** | Lower-middle SEA/MENA/LATAM mass (ID, PH, VN, EG, MA, UA) | $1.99 | $14.99 | $2.99 | $22.99 | 23 |
| **T7** | Lower-middle South Asia + frontier (IN, PK, BD, LK, KE, KH) | $0.99 | $9.99 | $1.99 | $14.99 | 17 |
| **T8** | Low income / floor (NG, ET, TZ, AF, MM, HT, YE) | $0.99 | $6.99 | $1.49 | $11.99 | 35 |

**DEFAULT (unlisted territory) → T5.** A sensible mid-emerging default; safer to under-price an
unmapped market than to over-price it (price *decreases* auto-apply, see §7).

**Annual discount:** annuals run ~7.0–7.7× the monthly (≈ 36–42% off vs 12× monthly), the standard
"pay yearly, save ~40%" lever that maximizes prepaid commitment. Examples: T1 iOS $12.99×12=$155.88 →
$99.99 annual (36% off); T5 Android $3.49×12=$41.88 → $27.99 (33% off); T7 Android $0.99×12=$11.88 →
$9.99 (16% off — floor compression, the monthly is already at the App Store minimum tier).

---

## 5. iOS vs Android gap logic

iOS ≥ Android in **every** tier. The gap is **small at the top and wide at the bottom**, by design:

- **Top tiers (T1–T2):** the gap is ~$2–3/mo. In rich countries the iOS and Android bases are both
  affluent, so the premium reflects the modest iOS ARPU skew, not a different segment.
- **Mid/low tiers (T5–T8):** the gap *widens in relative terms* (e.g. T7 iOS monthly is 2× Android;
  T8 iOS annual is 1.7× Android). **Rationale:** in low-income countries the smartphone base is
  overwhelmingly cheap Android; owning an iPhone signals top-decile (often top-percentile) household
  income. An iPhone user in Lagos, Karachi or Cairo has a willingness-to-pay closer to a Western
  consumer than to the median local Android user. So we charge the local Android base a true rock-
  bottom price (volume) while extracting a "rich-within-a-poor-market" premium from iOS — the classic
  example the owner cited: *an iPhone in Saudi Arabia ≈ rich-country price; an Android there ≈ steep
  discount.* (Saudi/Gulf are split here: KSA/Kuwait/Bahrain sit at T3, the Android price already
  reflecting a discount off the Gulf's high headline GNI, while iOS within T3 carries the premium.)

This is the single most valuable lever given $0 marginal cost: it lets one country span two effective
price points without leaving money on the table or pricing out the mass Android market.

---

## 6. Key country callouts

- **United States / Switzerland / Norway / Singapore / Australia (T1).** Ceiling. iOS annual $99.99
  sits a clean notch under Duolingo's $119.99 — "premium, but cheaper than the incumbent."
- **India (T7).** The flagship cheap market. Android **$0.99/mo · $9.99/yr**; iOS **$1.99/mo ·
  $14.99/yr**. Below Duolingo's ~$14/yr PPP annual on Android; iOS matches it. Validates the owner's
  ~$1.20/mo · ~$9.99/yr hypothesis (we land Android annual exactly at $9.99).
- **Indonesia (T6).** Android **$1.99/mo · $14.99/yr**; iOS **$2.99/mo · $22.99/yr**. Owner
  hypothesized ~$2/mo · ~$15/yr → matched on Android. iOS carries the premium (Indonesian iPhone
  base is a small, affluent slice). Both below Duolingo's ~$27/yr.
- **Brazil (T5).** Android **$3.49/mo · $27.99/yr**; iOS **$4.99/mo · $35.99/yr**. Brazil's iPhone
  is a luxury good (high import duties) → strong iOS/Android split is well justified. iOS annual
  matches Duolingo's ~$35; Android undercuts to ~$28.
- **Saudi Arabia / Gulf (T3, except Qatar/UAE).** High headline GNI but we keep Android at T3
  ($6.99/$54.99) rather than T1 — the resident Android base (large expat-worker population) is far
  less affluent than GNI suggests. iOS within T3 ($8.99/$67.99) captures the wealthy iPhone segment.
  Qatar → T1 and UAE → T2 (genuinely top-end consumer bases).
- **Turkey (T5).** Severe lira depreciation; we price in USD-equivalent and let the store resolve to
  local points. Android $27.99/yr ≈ Duolingo's ~$24 cluster; do **not** chase the lira down further —
  the USD-equiv target protects us from FX collapse.
- **China (T4).** Upper-middle, large, price-sensitive but a big affluent urban core → $4.99/$39.99
  Android. (Note: distribution on Android in CN is via third-party stores; iOS via the China App
  Store. Pricing target holds regardless of channel.)
- **Nigeria (T8 Android, T7-equiv via iOS premium).** Mapped T8: Android floor $0.99/mo · $6.99/yr;
  iOS $1.49/mo · $11.99/yr. The naira is volatile — USD-equivalent targeting is essential; the iOS
  premium captures the tiny but real Lagos/Abuja iPhone elite.

---

## 7. FX / PPP and store price-change mechanics (CAVEATS)

**USD-equivalent, not literal USD.** All values are *targets*. The tooling maps each target to the
nearest local App Store / Google Play **price point** in local currency, and the stores apply local
VAT/GST on top where required. We deliberately target shelf price net of tax; in VAT-inclusive
jurisdictions (most of the EU) the displayed local price will be higher than the USD-equivalent
implies — that is expected and consistent with Duolingo.

**FX volatility.** For soft/volatile currencies (TRY, NGN, ARS, EGP), targeting in USD-equivalent
protects revenue: when the local currency falls, the resolved local price rises to hold the USD
target, rather than collapsing. Re-resolve price points periodically (stores update their FX-based
tier tables) — but only *downward* moves are free (see below).

**Price-change mechanics — the important caveat:**

- **Apple App Store & Google Play: price DECREASES auto-apply** to existing subscribers at their next
  renewal with no action required. Since Corpán's whole strategy is to *lower* prices into poorer
  markets and undercut Duolingo, **the vast majority of changes from any prior/global price are
  decreases → low-risk, no consent friction.**
- **Price INCREASES for existing subscribers require consent/notification.** On Apple, a "preserve
  current price" option exists; without explicit handling, an increase pauses the subscriber's
  renewal until they re-consent (Apple) or after advance notice they may be auto-opted with a window
  to cancel (Google), per current store policy. **Flag any tier change that would RAISE an existing
  subscriber's price** — these are the only changes that need a comms/consent plan. New subscribers
  always get the new price immediately regardless.
- **Practical guidance:** when adjusting this matrix, audit the diff for any country whose resolved
  local price would *increase* for current subscribers; treat those as a separate, slower rollout
  with the store's "keep existing subscribers at old price" / grandfathering option enabled. All
  decreases can ship immediately.

**Apple/Google minimum price points.** $0.99/mo and ~$6.99/yr are near the practical store minimums
for paid subscriptions in most currencies — T7/T8 sit at the floor. We cannot go meaningfully lower
without free / ad-supported tiers, which is a separate product decision.

---

## 8. Sources

- Papora — "Super Duolingo prices: how much does it cost in 2026?"
  https://www.papora.com/learn-english/super-duolingo-prices/  (US, UK, EU, ES, BR, IN, CA, AU prices)
- FamilyPro — "Duolingo Price in Different Countries"
  https://familypro.io/en/duolingo-price-in-different-countries  (annual plan prices incl. TRY 499.99)
- World Bank — "Country and Lending Groups" (income classification, FY2026)
  https://datahelpdesk.worldbank.org/knowledgebase/articles/906519-world-bank-country-and-lending-groups
- Our World in Data — "World Bank income groups" (thresholds: high >$13,935; UM $4,496–13,935;
  LM $1,136–4,495; low ≤$1,135) https://ourworldindata.org/grapher/world-bank-income-groups
- iTop VPN — "Duolingo cheapest country" (cross-check on headline annual SKU; used only for sanity)
  https://www.itopvpn.com/blog/duolingo-cheapest-country-7337
- Owner-supplied PPP cheap-annual cluster (India $14 … Saudi $57) — used as the bottom-tier floor.
