#!/usr/bin/env python3
"""
play_monetization.py — script the Google Play subscription monetization setup
that the Play Console makes painful to click through.

What this DOES (no Console UI needed):
  - list        : read-only dump of subscriptions, base plans (+ legacyCompatible
                  status), and offers. Run this FIRST to discover your base-plan ids.
  - trial       : create + (optionally) activate a free-trial OFFER on a base plan.
                  A free trial is a base-plan offer, NOT a promo code — it needs
                  neither backward-compatibility nor the Console.
  - affiliate-offer : create + (optionally) activate a per-affiliate-code DISCOUNT
                  OFFER on a base plan (e.g. IAN30 -> 30% off). Like `trial` it's a
                  base-plan offer, NOT a promo code, but it's deliberately
                  developer-determined (empty targeting) so Play will NEVER auto-show
                  it. The app applies it by passing the matching offerToken only after
                  the typed code is validated by the backend; attribution flows back via
                  subscriptionsv2.get -> lineItems[].offerDetails.offerId/offerTags.
  - backcompat  : set a base plan's autoRenewingBasePlanType.legacyCompatible = true
                  (read-modify-write patch). This is the flag Play demands before it
                  will let you create a PROMO CODE for the subscription.
  - set-prices  : apply REGIONAL per-country base-plan prices from a pricing matrix
                  (corpan/infra/pricing/pricing-matrix.json). For each country it
                  resolves its tier's android target (USD), converts that USD to a
                  sensible tax-adjusted LOCAL price via monetization.convertRegionPrices,
                  rounds to a clean local price, and read-modify-writes ONLY the targeted
                  regions' price on basePlans[].regionalConfigs[] (updateMask=basePlans).
                  AFFECTS NEW PURCHASES ONLY — existing subscribers keep their price
                  unless you run a price-change cohort (see README); this tool never
                  silently migrates existing subscribers.

What this CANNOT do (Google has no API for it):
  - Generating PROMO CODES / "Promotions" is Console-only. After `backcompat`,
    create codes at: Play Console > Monetize with Play > Promo codes. See README.md.

Auth: reuses the SAME Google service account the verify lambda uses. By default it
pulls `google.serviceAccountJson` from AWS Secrets Manager (secret id defaults to
"corpan/content-packs/verify", overridable with --secret-id / $PLAY_SECRET_ID), so
you need AWS creds in the environment. Or pass a local key file with
--key /path/to/service-account.json.

The service account must be linked in Play Console (Users & permissions) with a role
that can MANAGE products/monetization (not just view orders). If `trial`/`backcompat`
return 401/403, grant it "Manage store presence / monetization" for the app.

Writes are DRY-RUN by default: they print the exact request and do nothing. Add --yes
to actually call the API (these are outward-facing — they change your live store).

Deps:  pip install google-api-python-client google-auth boto3
Usage:
  python play_monetization.py list
  python play_monetization.py trial --product corpan.sub.monthly --base-plan <id> --days 7
  python play_monetization.py trial --product corpan.sub.monthly --base-plan <id> --days 7 --activate --yes
  python play_monetization.py backcompat --product corpan.sub.monthly --base-plan <id> --yes
  python play_monetization.py affiliate-offer --product corpan.sub.monthly --base-plan corpan-sub-monthly --code IAN30
  python play_monetization.py affiliate-offer --product corpan.sub.annual --base-plan corpan-sub-anual --code IAN30 --activate --yes
  python play_monetization.py set-prices --product corpan.sub.monthly --base-plan corpan-sub-monthly --period monthly --matrix ../pricing/pricing-matrix.json
  python play_monetization.py set-prices --product corpan.sub.annual  --base-plan corpan-sub-anual  --period annual  --matrix ../pricing/pricing-matrix.json --only US,ID,IN --yes
"""
import argparse
import json
import os
import sys

PACKAGE_NAME = os.environ.get("PLAY_PACKAGE_NAME", "com.corpora.corpan")
DEFAULT_SECRET_ID = os.environ.get("PLAY_SECRET_ID", "corpan/content-packs/verify")
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
# Required on subscription/offer create+patch. Use the LATEST published regions
# version (the API rejects older ones with "latest value is ...") so currencies match
# Google's live catalog (BG->EUR, CI->XOF migrations); the frozen 2022/02 conflicts.
# Overridable via env; bump when Google publishes a newer one.
REGIONS_VERSION = os.environ.get("PLAY_REGIONS_VERSION", "2025/03")


def _load_service_account_info(args) -> dict:
    if args.key:
        with open(args.key, "r") as f:
            return json.load(f)
    # Default: same secret the verify lambda reads (google.serviceAccountJson).
    try:
        import boto3
    except ImportError:
        sys.exit("boto3 not installed and no --key given. `pip install boto3` or pass --key.")
    sm = boto3.client("secretsmanager")
    secret = json.loads(sm.get_secret_value(SecretId=args.secret_id)["SecretString"])
    google = secret.get("google", {})
    raw = google.get("serviceAccountJson")
    if not raw:
        sys.exit(f"Secret {args.secret_id} has no google.serviceAccountJson.")
    return raw if isinstance(raw, dict) else json.loads(raw)


def _client(args):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    info = _load_service_account_info(args)
    creds = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
    # cache_discovery=False avoids the noisy file-cache warning on modern clients.
    return build("androidpublisher", "v3", credentials=creds, cache_discovery=False)


def cmd_list(args):
    svc = _client(args)
    subs = svc.monetization().subscriptions().list(packageName=PACKAGE_NAME).execute()
    items = subs.get("subscriptions", [])
    if not items:
        print("(no subscriptions found for", PACKAGE_NAME, ")")
        return
    for sub in items:
        pid = sub.get("productId")
        print(f"\n=== subscription: {pid} ===")
        for bp in sub.get("basePlans", []):
            bpid = bp.get("basePlanId")
            art = bp.get("autoRenewingBasePlanType") or {}
            legacy = art.get("legacyCompatible", False)
            period = art.get("billingPeriodDuration") or (bp.get("prepaidBasePlanType") or {}).get("billingPeriodDuration")
            state = bp.get("state")
            flag = "  <-- backward compatible" if legacy else ""
            print(f"  base plan: {bpid}  [{state}]  period={period}{flag}")
            try:
                offers = (
                    svc.monetization().subscriptions().basePlans().offers()
                    .list(packageName=PACKAGE_NAME, productId=pid, basePlanId=bpid)
                    .execute()
                ).get("subscriptionOffers", [])
            except Exception as e:  # offers().list can 404 on some states
                offers = []
                print(f"      (offers unavailable: {e})")
            for off in offers:
                phases = off.get("phases", [])
                kinds = []
                for ph in phases:
                    rc = (ph.get("regionalConfigs") or [{}])[0]
                    if "free" in rc or ("otherRegionsConfig" in ph):
                        kinds.append(f"{ph.get('duration')}/free?")
                    else:
                        kinds.append(ph.get("duration"))
                print(f"      offer: {off.get('offerId')}  [{off.get('state')}]  phases={kinds}")


def _base_plan_regions(svc, product_id, base_plan_id):
    """The region codes a base plan is sold in — an offer must target >=1 of them."""
    sub = svc.monetization().subscriptions().get(
        packageName=PACKAGE_NAME, productId=product_id).execute()
    for bp in sub.get("basePlans", []):
        if bp.get("basePlanId") == base_plan_id:
            return [rc["regionCode"] for rc in bp.get("regionalConfigs", []) if rc.get("regionCode")]
    sys.exit(f"base plan {base_plan_id} not found on {product_id}. Run `list`.")


def _base_plan_period(svc, product_id, base_plan_id):
    """ISO-8601 billing period of a base plan (e.g. 'P1Y' / 'P1M').

    A subscription-offer phase requires an explicit `duration`; the discount
    phase lasts one base-plan billing cycle, repeated `recurrenceCount` times.
    """
    sub = svc.monetization().subscriptions().get(
        packageName=PACKAGE_NAME, productId=product_id).execute()
    for bp in sub.get("basePlans", []):
        if bp.get("basePlanId") == base_plan_id:
            art = bp.get("autoRenewingBasePlanType") or {}
            period = art.get("billingPeriodDuration")
            if period:
                return period
    sys.exit(f"could not resolve billing period for base plan {base_plan_id}. Run `list`.")


def _trial_body(product_id, base_plan_id, offer_id, days, anchor_region):
    # A free trial = one offer phase, duration P{days}D, price override `free`.
    # Play requires the offer to explicitly target >=1 region, but enumerating ALL
    # base-plan regions trips per-region billability validation (e.g. MN isn't
    # billable at regions version 2022/02). So we anchor ONE reliably-billable region
    # explicitly and let `otherRegionsConfig.free` cover every other region the base
    # plan sells in — the catch-all is NOT subject to the per-region billability check.
    # acquisitionRule scopes the trial to people who never had this subscription.
    return {
        "packageName": PACKAGE_NAME,
        "productId": product_id,
        "basePlanId": base_plan_id,
        "offerId": offer_id,
        "phases": [
            {
                "duration": f"P{days}D",
                "recurrenceCount": 1,
                # Per-phase PRICING: free in the anchor region + all other regions.
                "regionalConfigs": [{"regionCode": anchor_region, "free": {}}],
                "otherRegionsConfig": {"free": {}},
            }
        ],
        "targeting": {
            "acquisitionRule": {
                # New-subscriber trial: eligible for users who have never had THIS
                # subscription. (Acquisition scope must be thisSubscription or
                # anySubscriptionInApp — specificSubscriptionInApp is rejected here.)
                "scope": {"thisSubscription": {}}
            }
        },
        # Offer-level AVAILABILITY (distinct from phase pricing): make the offer
        # available to new subscribers in the anchor region + every other region
        # (incl. future Play launches), so the trial is effectively global without
        # enumerating non-billable regions.
        "regionalConfigs": [
            {"regionCode": anchor_region, "newSubscriberAvailability": True}
        ],
        "otherRegionsConfig": {"otherRegionsNewSubscriberAvailability": True},
    }


def cmd_trial(args):
    offer_id = args.offer_id or f"free-trial-{args.days}d"
    svc = _client(args)
    regions = _base_plan_regions(svc, args.product, args.base_plan)
    anchor = args.anchor_region if args.anchor_region in regions else ("US" if "US" in regions else (regions[0] if regions else "US"))
    body = _trial_body(args.product, args.base_plan, offer_id, args.days, anchor)
    print(f"create offer {offer_id} on {args.product}/{args.base_plan} "
          f"({args.days}-day free trial; anchor region {anchor} + all other regions):")
    print(json.dumps(body, indent=2))
    if not args.yes:
        print("\n[dry-run] add --yes to create. (then --activate to make it live)")
        return
    created = (
        svc.monetization().subscriptions().basePlans().offers()
        .create(
            packageName=PACKAGE_NAME, productId=args.product, basePlanId=args.base_plan,
            offerId=offer_id, **{"regionsVersion_version": REGIONS_VERSION}, body=body,
        )
        .execute()
    )
    print("created (DRAFT):", created.get("offerId"), created.get("state"))
    if args.activate:
        active = (
            svc.monetization().subscriptions().basePlans().offers()
            .activate(packageName=PACKAGE_NAME, productId=args.product,
                      basePlanId=args.base_plan, offerId=offer_id)
            .execute()
        )
        print("activated:", active.get("offerId"), active.get("state"))
    else:
        print("offer is DRAFT — re-run with --activate (or activate in Console) to go live.")


def _affiliate_body(product_id, base_plan_id, offer_id, code_tag, relative_discount,
                    months, anchor_region, duration):
    # A per-affiliate-code discount = ONE offer phase whose price is overridden by a
    # `relativeDiscount` (the FRACTION the user PAYS, in the open interval (0,1)). So
    # "30% off" = relativeDiscount 0.70. This mirrors `_trial_body` exactly, but swaps
    # the per-region `free: {}` override for `relativeDiscount: <0..1>`.
    #
    # Field shapes (androidpublisher v3, verified):
    #   - RegionalSubscriptionOfferPhaseConfig: { regionCode, price|relativeDiscount|
    #       absoluteDiscount|free }. `relativeDiscount` is a number.
    #       https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.subscriptions.basePlans.offers#RegionalSubscriptionOfferPhaseConfig
    #   - OtherRegionsSubscriptionOfferPhaseConfig: { otherRegionsPrices|relativeDiscount|
    #       absoluteDiscounts|free }. SAME field name `relativeDiscount` for the catch-all.
    #       https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.subscriptions.basePlans.offers#OtherRegionsSubscriptionOfferPhaseConfig
    #   - OfferTag: { tag } — RFC-1034: lower-case a-z, 0-9, hyphens; <=20 chars. We use
    #       `code-<lowercased-code>` (e.g. "code-ian30") for backend attribution via
    #       subscriptionsv2.get -> lineItems[].offerDetails.offerTags.
    #       https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.subscriptions.basePlans.offers#OfferTag
    #
    # We anchor ONE reliably-billable region explicitly (Play requires >=1 targeted
    # region) and let `otherRegionsConfig.relativeDiscount` cover every other region the
    # base plan sells in — same non-billable-region dodge as the trial (MN etc. at
    # regions version 2022/02 fail the per-region billability check; the catch-all does
    # not). recurrenceCount = months: the discount applies for that many billing cycles,
    # then renews at full price. (Monthly base plan -> ~`months` months; annual base
    # plan -> recurrenceCount 1 = the first year discounted; see --months default note.)
    return {
        "packageName": PACKAGE_NAME,
        "productId": product_id,
        "basePlanId": base_plan_id,
        "offerId": offer_id,
        "offerTags": [{"tag": code_tag}],
        "phases": [
            {
                # Each phase needs an explicit ISO-8601 duration = one base-plan
                # billing cycle; recurrenceCount repeats it that many times.
                "duration": duration,
                # The discount recurs for `months` billing cycles of the base plan.
                "recurrenceCount": months,
                # Per-phase PRICING: relativeDiscount in the anchor region + all others.
                # relativeDiscount is the FRACTION PAID, so 0.70 == 30% off.
                "regionalConfigs": [
                    {"regionCode": anchor_region, "relativeDiscount": relative_discount}
                ],
                "otherRegionsConfig": {"relativeDiscount": relative_discount},
            }
        ],
        # DEVELOPER-DETERMINED eligibility: omit `targeting` entirely (no acquisitionRule,
        # no upgradeRule). Per the androidpublisher docs, an empty/omitted
        # SubscriptionOfferTargeting means "developer-determined offer eligibility" — Play
        # will NOT auto-surface this offer; it is only redeemable when the app explicitly
        # passes its offerToken (which we do after the backend validates the typed code).
        # (No "targeting" key here on purpose.)
        #
        # Offer-level AVAILABILITY (distinct from phase pricing): make the offer available
        # to new subscribers in the anchor region + every other region (incl. future Play
        # launches), so the code works globally without enumerating non-billable regions.
        "regionalConfigs": [
            {"regionCode": anchor_region, "newSubscriberAvailability": True}
        ],
        "otherRegionsConfig": {"otherRegionsNewSubscriberAvailability": True},
    }


def cmd_affiliate_offer(args):
    code = args.code.strip()
    if not code:
        sys.exit("--code is required (e.g. IAN30).")
    code_tag = f"code-{code.lower()}"
    # RFC-1034 sanity: offerId / OfferTag.tag allow only a-z 0-9 '-', <=20 chars.
    if not all(c.isalnum() or c == "-" for c in code_tag) or len(code_tag) > 20:
        sys.exit(f"derived offer tag '{code_tag}' is not RFC-1034-safe (<=20 chars, "
                 f"lower-case letters/digits/hyphens only). Pick a shorter/cleaner code.")
    offer_id = args.offer_id or code_tag
    percent = args.percent_off
    if not (0 < percent < 100):
        sys.exit(f"--percent-off must be in (0,100); got {percent}.")
    # relativeDiscount is the FRACTION THE USER PAYS, range (0,1). 30% off -> 0.70.
    relative_discount = round(1 - percent / 100.0, 6)

    svc = _client(args)
    regions = _base_plan_regions(svc, args.product, args.base_plan)
    period = _base_plan_period(svc, args.product, args.base_plan)
    anchor = args.anchor_region if args.anchor_region in regions else (
        "US" if "US" in regions else (regions[0] if regions else "US"))
    body = _affiliate_body(args.product, args.base_plan, offer_id, code_tag,
                           relative_discount, args.months, anchor, period)
    print(f"create affiliate-discount offer {offer_id} (tag {code_tag}) on "
          f"{args.product}/{args.base_plan}: {percent:g}% off "
          f"(relativeDiscount={relative_discount}) for {args.months} billing cycle(s); "
          f"developer-determined eligibility (NOT auto-shown); anchor region {anchor} + "
          f"all other regions:")
    print(json.dumps(body, indent=2))
    if not args.yes:
        print("\n[dry-run] add --yes to create. (then --activate to make it live)")
        return
    created = (
        svc.monetization().subscriptions().basePlans().offers()
        .create(
            packageName=PACKAGE_NAME, productId=args.product, basePlanId=args.base_plan,
            offerId=offer_id, **{"regionsVersion_version": REGIONS_VERSION}, body=body,
        )
        .execute()
    )
    print("created (DRAFT):", created.get("offerId"), created.get("state"))
    if args.activate:
        active = (
            svc.monetization().subscriptions().basePlans().offers()
            .activate(packageName=PACKAGE_NAME, productId=args.product,
                      basePlanId=args.base_plan, offerId=offer_id)
            .execute()
        )
        print("activated:", active.get("offerId"), active.get("state"))
    else:
        print("offer is DRAFT — re-run with --activate (or activate in Console) to go live.")


def cmd_backcompat(args):
    svc = _client(args)
    sub = svc.monetization().subscriptions().get(
        packageName=PACKAGE_NAME, productId=args.product).execute()
    found = False
    for bp in sub.get("basePlans", []):
        is_target = bp.get("basePlanId") == args.base_plan
        art = bp.get("autoRenewingBasePlanType")
        if art is not None:
            # Exactly one base plan may be legacyCompatible; flip the rest off.
            art["legacyCompatible"] = bool(is_target)
        if is_target:
            found = True
    if not found:
        sys.exit(f"base plan {args.base_plan} not found on {args.product}. Run `list`.")
    print(f"patch {args.product}: set legacyCompatible=true on {args.base_plan} (others false):")
    print(json.dumps(sub.get("basePlans"), indent=2))
    if not args.yes:
        print("\n[dry-run] add --yes to patch.")
        return
    updated = svc.monetization().subscriptions().patch(
        packageName=PACKAGE_NAME, productId=args.product, updateMask="basePlans",
        **{"regionsVersion_version": REGIONS_VERSION}, body=sub,
    ).execute()
    for bp in updated.get("basePlans", []):
        art = bp.get("autoRenewingBasePlanType") or {}
        print(f"  {bp.get('basePlanId')}: legacyCompatible={art.get('legacyCompatible', False)}")
    print("\nDone. Promo codes can now be created in: Play Console > Monetize with Play > Promo codes.")


# ---------------------------------------------------------------------------
# set-prices : apply REGIONAL per-country base-plan prices from a pricing matrix.
# ---------------------------------------------------------------------------
#
# API mechanics (androidpublisher v3, verified against the docs):
#
#   USD target -> local Money:  monetization.convertRegionPrices
#     POST .../applications/{packageName}/pricing:convertRegionPrices
#     body = {"price": {currencyCode:"USD", units, nanos}}   # tax-EXCLUSIVE input
#     -> { "convertedRegionPrices": { "<REGION>": { "regionCode", "price"<-tax-INCLUSIVE Money,
#                                                    "taxAmount" }, ... },
#          "convertedOtherRegionsPrice": { "usdPrice", "eurPrice" },
#          "regionVersion": {...} }
#     One call returns Google's exchange-rate + tax-adjusted local Money for EVERY region,
#     so we make ONE call per distinct USD target (not per country) and index the result.
#     https://developers.google.com/android-publisher/api-ref/rest/v3/monetization/convertRegionPrices
#
#   Apply the local price:  read-modify-write monetization.subscriptions.patch
#     We GET the whole subscription, locate the target base plan, and set
#     basePlans[].regionalConfigs[].price (a Money) ONLY on the regions we're targeting,
#     leaving every other region / field untouched, then patch with
#     updateMask="basePlans" and regionsVersion.version=2022/02. RegionalBasePlanConfig =
#     { regionCode, newSubscriberAvailability, price:{currencyCode,units,nanos} }.
#     https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.subscriptions/patch
#
# Money: { currencyCode (ISO 4217), units (string whole units), nanos (int, 10^-9, 0..1e9) }.
# https://developers.google.com/android-publisher/api-ref/rest/v3/Money
#
# Existing subscribers: a base-plan price change affects NEW purchases only. Existing
# subscribers keep their current price until you run a Play "price change" cohort
# (Console / dedicated API), which we deliberately do NOT do here. Decreases are
# low-risk; increases need an opt-in/notify cohort. See README.


def _money_to_float(money) -> float:
    if not money:
        return 0.0
    return int(money.get("units") or 0) + (int(money.get("nanos") or 0) / 1e9)


def _money_str(money) -> str:
    if not money:
        return "—"
    return f"{_money_to_float(money):.2f} {money.get('currencyCode', '?')}"


# Currencies conventionally quoted WITHOUT minor units (no decimals). Rounding to a clean
# price for these means whole units (nanos=0); a stray fractional unit looks broken.
_ZERO_DECIMAL_CCY = {
    "JPY", "KRW", "VND", "IDR", "CLP", "ISK", "HUF", "PYG", "UGX", "RWF", "VUV",
    "XAF", "XOF", "XPF", "DJF", "GNF", "KMF", "MGA", "BIF",
}


def _clean_local_money(money) -> dict:
    """Round Google's converted Money to a clean human price in its own currency.

    Strategy (keep it boring & predictable — not psychological .99 pricing, which
    would need per-currency rules we don't want to own):
      - zero-decimal currencies (JPY/KRW/IDR/…): round to a whole unit (nanos=0).
        For larger amounts, round to a tidy step (nearest 100 >=1000, nearest 10 >=100)
        so we get e.g. ¥1500 / Rp149000, not ¥1487.
      - everything else: round to 2 decimals (nanos to the nearest 10,000,000 = 0.01).
    Returns a fresh Money dict; never mutates the input.
    """
    ccy = (money or {}).get("currencyCode", "")
    amount = _money_to_float(money)
    if ccy in _ZERO_DECIMAL_CCY:
        if amount >= 1000:
            amount = round(amount / 100.0) * 100
        elif amount >= 100:
            amount = round(amount / 10.0) * 10
        else:
            amount = round(amount)
        return {"currencyCode": ccy, "units": str(int(amount)), "nanos": 0}
    # 2-decimal currency: round to the cent.
    cents = round(amount * 100)
    units = cents // 100
    nanos = (cents % 100) * 10_000_000  # 0.01 == 10,000,000 nanos
    return {"currencyCode": ccy, "units": str(int(units)), "nanos": int(nanos)}


def _load_matrix(path):
    if not os.path.exists(path):
        sys.exit(
            f"pricing matrix not found: {path}\n"
            f"Expected corpan/infra/pricing/pricing-matrix.json (schema: version, unit, "
            f"tiers[].android.{{monthly,annual}}, countryTier{{ISO2->tierId}}).\n"
            f"Another team fills the values — create it (with at least a DEFAULT tier) first."
        )
    with open(path, "r") as f:
        try:
            matrix = json.load(f)
        except json.JSONDecodeError as e:
            sys.exit(f"pricing matrix {path} is not valid JSON: {e}")
    tiers = {t["id"]: t for t in matrix.get("tiers", []) if t.get("id")}
    if not tiers:
        sys.exit(f"pricing matrix {path} has no tiers[].")
    country_tier = matrix.get("countryTier") or {}
    if not country_tier:
        sys.exit(f"pricing matrix {path} has no countryTier{{}} map.")
    return matrix, tiers, country_tier


def _target_usd(tiers, country_tier, country, period, default_tier):
    """Resolve a country's android target USD for the given period, falling back to DEFAULT."""
    tier_id = country_tier.get(country) or default_tier
    tier = tiers.get(tier_id)
    if not tier:
        return None, tier_id
    target = ((tier.get("android") or {}).get(period))
    return target, tier_id


def _usd_money(usd: float) -> dict:
    units = int(usd)
    nanos = int(round((usd - units) * 1e9))
    return {"currencyCode": "USD", "units": str(units), "nanos": nanos}


def cmd_set_prices(args):
    period = args.period
    if period not in ("monthly", "annual"):
        sys.exit("--period must be 'monthly' or 'annual'.")
    matrix, tiers, country_tier = _load_matrix(args.matrix)
    default_tier = country_tier.get("DEFAULT")

    only = None
    if args.only:
        only = {c.strip().upper() for c in args.only.split(",") if c.strip()}

    # Countries to price = every entry in countryTier (excluding the DEFAULT sentinel),
    # optionally filtered by --only. Play region codes ARE ISO 3166-1 alpha-2 already.
    countries = sorted(
        c.upper() for c in country_tier.keys()
        if c.upper() != "DEFAULT" and (only is None or c.upper() in only)
    )
    if only:
        missing = only - set(countries)
        if missing:
            # --only countries not explicitly in the matrix still get the DEFAULT tier.
            for c in sorted(missing):
                if default_tier:
                    countries.append(c)
            countries = sorted(set(countries))
    if not countries:
        sys.exit("no countries to price (countryTier empty or --only matched nothing).")

    svc = _client(args)

    # The set of regions this base plan actually sells in. We can only price regions the
    # base plan covers; others are skipped (logged), like the trial tool skips non-billable.
    sellable = set(_base_plan_regions(svc, args.product, args.base_plan))

    # Group target countries by their USD target so we make ONE convertRegionPrices call
    # per distinct USD amount (it returns local Money for ALL regions at once).
    usd_by_country = {}
    skipped = []
    for country in countries:
        target, tier_id = _target_usd(tiers, country_tier, country, period, default_tier)
        if target is None:
            skipped.append((country, f"no {period} android target (tier {tier_id})"))
            continue
        if sellable and country not in sellable:
            skipped.append((country, "region not sold by this base plan"))
            continue
        usd_by_country[country] = float(target)

    # Convert each distinct USD target once.
    converted_cache = {}  # usd(float) -> convertedRegionPrices map {region: {price,...}}
    for usd in sorted(set(usd_by_country.values())):
        body = {"price": _usd_money(usd)}
        try:
            resp = svc.monetization().convertRegionPrices(
                packageName=PACKAGE_NAME, body=body).execute()
        except Exception as e:
            sys.exit(f"convertRegionPrices failed for ${usd:.2f}: {e}")
        converted_cache[usd] = resp.get("convertedRegionPrices", {}) or {}

    # Build the per-region price plan: region -> clean local Money.
    plan = {}  # regionCode -> {"usd": float, "money": Money}
    for country, usd in usd_by_country.items():
        crp = converted_cache.get(usd, {})
        entry = crp.get(country)
        if not entry or not entry.get("price"):
            skipped.append((country, f"convertRegionPrices returned no price (non-billable @ {REGIONS_VERSION}?)"))
            continue
        clean = _clean_local_money(entry["price"])  # tax-inclusive local Money, rounded clean
        plan[country] = {"usd": usd, "money": clean}

    # Print the table.
    print(f"set-prices: {args.product}/{args.base_plan} period={period} "
          f"matrix={args.matrix} (v{matrix.get('version','?')})")
    print(f"  {'REGION':<7} {'TIER':<5} {'TARGET USD':<11} LOCAL PRICE")
    for country in sorted(plan):
        usd = plan[country]["usd"]
        tier_id = country_tier.get(country, default_tier)
        print(f"  {country:<7} {str(tier_id):<5} ${usd:<10.2f} {_money_str(plan[country]['money'])}")
    for country, why in sorted(skipped):
        print(f"  {country:<7} SKIP  -           ({why})")

    if not plan:
        sys.exit("\nnothing to price (all targets skipped). Nothing patched.")

    # Read-modify-write: GET the subscription, set ONLY the targeted regions' price on the
    # target base plan's regionalConfigs[], preserving every other region/field.
    sub = svc.monetization().subscriptions().get(
        packageName=PACKAGE_NAME, productId=args.product).execute()
    target_bp = None
    for bp in sub.get("basePlans", []):
        if bp.get("basePlanId") == args.base_plan:
            target_bp = bp
            break
    if target_bp is None:
        sys.exit(f"base plan {args.base_plan} not found on {args.product}. Run `list`.")

    rconfigs = target_bp.setdefault("regionalConfigs", [])
    by_region = {rc.get("regionCode"): rc for rc in rconfigs}
    # Snapshot each region's ORIGINAL price so a store-rejected region can be reverted
    # and the patch retried (the patch is atomic — one bad region fails all).
    orig_price = {rc.get("regionCode"): json.loads(json.dumps(rc.get("price"))) if rc.get("price") else None
                  for rc in rconfigs}
    changes = 0
    cur_skips = []
    for country, info in plan.items():
        rc = by_region.get(country)
        if rc is None:
            # Region sold by the base plan but absent from regionalConfigs (shouldn't
            # happen since `sellable` is derived from it) — add a config rather than
            # silently dropping the price.
            rc = {"regionCode": country, "newSubscriberAvailability": True}
            rconfigs.append(rc)
            by_region[country] = rc
        # convertRegionPrices can return a currency the base plan does NOT expect for
        # this region at regionsVersion 2022/02 (e.g. Bulgaria moved to EUR in Google's
        # newer catalog, but 2022/02 still expects BGN). The patch is ATOMIC — one
        # mismatched region rejects ALL of them — so skip it (keep its current price).
        existing_cur = (rc.get("price") or {}).get("currencyCode")
        new_cur = (info["money"] or {}).get("currencyCode")
        if existing_cur and new_cur and existing_cur != new_cur:
            cur_skips.append((country, existing_cur, new_cur))
            continue
        rc["price"] = info["money"]  # set ONLY price; leave newSubscriberAvailability etc.
        changes += 1
    if cur_skips:
        print("\ncurrency-mismatch regions skipped (kept current price — set manually if needed):")
        for country, exp, got in sorted(cur_skips):
            print(f"  {country}: base plan expects {exp}, convertRegionPrices returned {got}")

    print(f"\npatch updateMask=basePlans (regionsVersion {REGIONS_VERSION}); "
          f"changing price on {changes} region(s) of {args.base_plan}; "
          f"all other regions/base-plans untouched.")
    print("NOTE: affects NEW purchases only — existing subscribers keep their price "
          "(no cohort price-change is run). Decreases are low-risk; for INCREASES, run a "
          "Play price-change cohort separately (see README).")
    print("patch body basePlans (target base plan regionalConfigs shown):")
    print(json.dumps(target_bp.get("regionalConfigs"), indent=2))

    if not args.yes:
        print("\n[dry-run] add --yes to patch.")
        return

    # The patch is atomic: a single region the store rejects (e.g. a currency the
    # 2022/02 regions version disallows, like BG=EUR/BGN) fails ALL of them. So retry,
    # dropping the offending region each time (reverting it to its original price),
    # until the patch succeeds or we run out of droppable regions.
    import re as _re
    # Currencies fixed-pegged to EUR — the 2022/02 regions version still expects the
    # legacy currency for these even though Google's live catalog moved them to EUR
    # (Bulgaria adopted the euro 2025-01 but BGN stays pegged at 1.95583/EUR). We can
    # therefore reprice deterministically instead of dropping the region.
    EUR_PEGS = {"BGN": 1.95583}
    dropped, repriced, tried = [], [], set()
    for _ in range(len(by_region) + 5):
        try:
            updated = svc.monetization().subscriptions().patch(
                packageName=PACKAGE_NAME, productId=args.product, updateMask="basePlans",
                **{"regionsVersion_version": REGIONS_VERSION}, body=sub,
            ).execute()
            break
        except Exception as e:
            em = _re.search(r"region code (\w+).*?Expected (\w+) but got (\w+)", str(e))
            rm = _re.search(r"region code (\w+)", str(e))
            bad = (em.group(1) if em else (rm.group(1) if rm else None))
            if not bad or bad not in by_region or bad in dropped:
                raise
            rc = by_region[bad]
            cur = (plan.get(bad) or {}).get("money") or rc.get("price") or {}
            expected = em.group(2) if em else None
            usd_target = (plan.get(bad) or {}).get("usd")
            if expected == "USD" and usd_target is not None and bad not in tried:
                # 2022/02 prices this region in USD (e.g. CFA-franc countries); set the
                # USD target directly.
                rc["price"] = _usd_money(float(usd_target))
                tried.add(bad)
                repriced.append((bad, f"${usd_target} USD"))
                continue
            if expected in EUR_PEGS and cur.get("currencyCode") == "EUR" and bad not in tried:
                eur = int(cur.get("units", "0")) + cur.get("nanos", 0) / 1e9
                amt = eur * EUR_PEGS[expected]
                rc["price"] = {"currencyCode": expected, "units": str(int(round(amt))), "nanos": 0}
                tried.add(bad)
                repriced.append((bad, f"{rc['price']['units']} {expected}"))
                continue  # retry with the pegged-currency price
            # Not repricable (e.g. 'not billable' at this version) — exclude this region
            # from the patch entirely so the rest applies; it keeps its current state.
            rconfigs[:] = [r for r in rconfigs if r.get("regionCode") != bad]
            by_region.pop(bad, None)
            dropped.append(bad)
    else:
        raise SystemExit("set-prices: too many rejected regions; aborting (no patch applied).")
    if repriced:
        print(f"\nrepriced {len(repriced)} EUR-peg region(s) to expected currency: " +
              ", ".join(f"{r}={p}" for r, p in repriced))
    if dropped:
        print(f"skipped {len(dropped)} store-rejected region(s) (kept current price): {', '.join(dropped)}")
    for bp in updated.get("basePlans", []):
        if bp.get("basePlanId") != args.base_plan:
            continue
        priced = sum(1 for rc in bp.get("regionalConfigs", []) if rc.get("price"))
        print(f"  {bp.get('basePlanId')}: {priced} region(s) now have an explicit price.")
    print("\nDone. Verify in Play Console > Monetize > Subscriptions > base plan prices.")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--key", help="local service-account JSON (default: pull from AWS Secrets Manager)")
    p.add_argument("--secret-id", default=DEFAULT_SECRET_ID, help=f"AWS secret id (default {DEFAULT_SECRET_ID})")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("list", help="read-only: dump subscriptions / base plans / offers")
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("trial", help="create a free-trial offer on a base plan")
    sp.add_argument("--product", required=True, help="subscription productId, e.g. corpan.sub.monthly")
    sp.add_argument("--base-plan", required=True, help="base plan id (from `list`)")
    sp.add_argument("--days", type=int, default=7)
    sp.add_argument("--anchor-region", default="US",
                    help="the one explicitly-targeted region (must be billable & sold); "
                         "all other base-plan regions are covered by the free catch-all")
    sp.add_argument("--offer-id", help="default: free-trial-<days>d")
    sp.add_argument("--activate", action="store_true", help="activate immediately (else stays DRAFT)")
    sp.add_argument("--yes", action="store_true", help="actually call the API (default dry-run)")
    sp.set_defaults(func=cmd_trial)

    sp = sub.add_parser("affiliate-offer",
                        help="create a per-affiliate-code discount offer (dev-determined, not auto-shown)")
    sp.add_argument("--product", required=True, help="subscription productId, e.g. corpan.sub.monthly")
    sp.add_argument("--base-plan", required=True, help="base plan id (from `list`), e.g. corpan-sub-monthly")
    sp.add_argument("--code", required=True, help="affiliate code, e.g. IAN30 (offer id/tag = code-<lowercased>)")
    sp.add_argument("--percent-off", type=float, default=30.0,
                    help="discount percent (default 30 -> relativeDiscount 0.70, the fraction paid)")
    sp.add_argument("--months", type=int, default=12,
                    help="billing cycles the discount recurs for (recurrenceCount). Default 12: "
                         "~12 months on a monthly base plan, or the first 12 years on an annual one "
                         "(so for annual base plans pass --months 1 to discount just the first year)")
    sp.add_argument("--anchor-region", default="US",
                    help="the one explicitly-targeted region (must be billable & sold); "
                         "all other base-plan regions are covered by the relativeDiscount catch-all")
    sp.add_argument("--offer-id", help="default: code-<lowercased-code>")
    sp.add_argument("--activate", action="store_true", help="activate immediately (else stays DRAFT)")
    sp.add_argument("--yes", action="store_true", help="actually call the API (default dry-run)")
    sp.set_defaults(func=cmd_affiliate_offer)

    sp = sub.add_parser("backcompat", help="mark a base plan backward compatible (unblocks promo codes)")
    sp.add_argument("--product", required=True)
    sp.add_argument("--base-plan", required=True)
    sp.add_argument("--yes", action="store_true", help="actually call the API (default dry-run)")
    sp.set_defaults(func=cmd_backcompat)

    sp = sub.add_parser("set-prices",
                        help="apply per-country regional base-plan prices from a pricing matrix")
    sp.add_argument("--product", required=True, help="subscription productId, e.g. corpan.sub.monthly")
    sp.add_argument("--base-plan", required=True, help="base plan id (from `list`), e.g. corpan-sub-monthly")
    sp.add_argument("--period", required=True, choices=["monthly", "annual"],
                    help="which android target to read per tier (android.monthly / android.annual)")
    sp.add_argument("--matrix", required=True,
                    help="path to pricing-matrix.json (e.g. ../pricing/pricing-matrix.json)")
    sp.add_argument("--only", help="comma-separated ISO-2 countries to limit to, e.g. US,ID,IN")
    sp.add_argument("--yes", action="store_true", help="actually call the API (default dry-run)")
    sp.set_defaults(func=cmd_set_prices)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
