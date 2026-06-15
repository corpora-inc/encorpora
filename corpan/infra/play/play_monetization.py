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
"""
import argparse
import json
import os
import sys

PACKAGE_NAME = os.environ.get("PLAY_PACKAGE_NAME", "com.corpora.corpan")
DEFAULT_SECRET_ID = os.environ.get("PLAY_SECRET_ID", "corpan/content-packs/verify")
SCOPE = "https://www.googleapis.com/auth/androidpublisher"
# Required on subscription/offer create+patch. Bump if Google deprecates it.
REGIONS_VERSION = "2022/02"


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
                    months, anchor_region):
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
    anchor = args.anchor_region if args.anchor_region in regions else (
        "US" if "US" in regions else (regions[0] if regions else "US"))
    body = _affiliate_body(args.product, args.base_plan, offer_id, code_tag,
                           relative_discount, args.months, anchor)
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

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
