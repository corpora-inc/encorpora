#!/usr/bin/env python3
"""
asc_monetization.py — script Corpán's App Store Connect subscription monetization
(free trials, offer codes) the way the ASC web UI makes painful to click through.
This is the Apple twin of ../play/play_monetization.py.

What this DOES (no App Store Connect web UI needed):
  - list          : read-only dump of the app's subscription groups, subscriptions,
                    their introductory offers, and their offer codes (+ one-time-use
                    batches / custom codes). Run this FIRST. It's how the integrator
                    sees "what a browser agent / a teammate already configured."
  - trial         : create a FREE_TRIAL subscriptionIntroductoryOffer (e.g. 7 days).
                    Apple intro offers are created ONE PER TERRITORY (see the long
                    note in cmd_trial) — this iterates the territories for you.
  - code-free     : create a FREE subscriptionOfferCode + generate a one-time-use
                    code BATCH (a CSV of single-use redemption codes).
  - code-discount : create a REAL %-off (PAY_AS_YOU_GO) subscriptionOfferCode + a
                    custom (reusable, your-string) code for affiliate attribution.
                    For EACH territory it reads the current base price and binds the
                    price point nearest (1 - percent/100) x base (Apple realizes a
                    discount only via a fixed price-point rung — there is no raw %).
  - pricepoints   : read-only helper — list a subscription's price-point ids for a
                    territory (you need a price-point id to price a paid offer/code).

Auth — App Store Connect API (ES256 JWT):
  We sign a short-lived (<=20 min) ES256 JWT with an ASC API .p8 private key.
    header:  { "alg": "ES256", "kid": <Key ID>, "typ": "JWT" }
    claims:  { "iss": <Issuer ID>, "kid": <Key ID>, "aud": "appstoreconnect-v1",
               "iat": now, "exp": now+~19min }
  Sent as `Authorization: Bearer <jwt>` to https://api.appstoreconnect.apple.com/v1.
  Ref: https://developer.apple.com/documentation/appstoreconnectapi/generating-tokens-for-api-requests

Creds resolution (first that applies wins):
  1. --key-file PATH --key-id ID --issuer-id ID  (all three flags), OR
  2. AWS Secrets Manager (default): secret id `corpan/content-packs/verify`
     (override with --secret-id / $ASC_SECRET_ID), JSON key `appStoreConnect`:
         { "keyId": "...", "issuerId": "...", "p8": "<full .p8 PEM contents>" }
     This key may not exist in the secret yet — you'll get a clean error telling
     you to populate it. (The repo is OPEN SOURCE; never hardcode these here.)

Writes are DRY-RUN by default: they print the exact JSON request body and do
nothing. Add --yes to actually POST (these change your live store).

We NEVER print the .p8 contents or the JWT.

Deps:  pip install pyjwt cryptography requests boto3
Usage:
  python asc_monetization.py list
  python asc_monetization.py pricepoints --product corpan.sub.monthly --territory USA
  python asc_monetization.py trial --product corpan.sub.monthly --days 7            # dry-run
  python asc_monetization.py trial --product corpan.sub.monthly --days 7 --yes
  python asc_monetization.py code-free --product corpan.sub.annual --count 100 --months 1 --yes
  python asc_monetization.py code-discount --product corpan.sub.monthly \
         --code IAN --percent-off 30 --months 1 --periods 12          # 30% off for 12 months (dry-run)
  python asc_monetization.py code-discount --product corpan.sub.annual \
         --code IAN --percent-off 30 --months 12 --periods 1 --yes    # 30% off the first year
"""
import argparse
import csv
import datetime as dt
import io
import json
import os
import sys
import time

BUNDLE_ID = os.environ.get("ASC_BUNDLE_ID", "com.corpora.corpan")
DEFAULT_SECRET_ID = os.environ.get("ASC_SECRET_ID", "corpan/content-packs/verify")
SECRET_KEY = "appStoreConnect"  # JSON key inside the secret -> {keyId, issuerId, p8}
BASE_URL = "https://api.appstoreconnect.apple.com/v1"
AUDIENCE = "appstoreconnect-v1"
JWT_TTL_SECONDS = 19 * 60  # Apple caps token lifetime at 20 min; stay under it.

# SubscriptionOfferDuration enum (Apple). Map a human day-count -> the ONLY durations
# Apple accepts. There is no arbitrary "N days": you pick the nearest enum.
# Ref: https://developer.apple.com/documentation/appstoreconnectapi/subscriptionofferduration
DURATION_BY_DAYS = {
    3: "THREE_DAYS",
    7: "ONE_WEEK",
    14: "TWO_WEEKS",
    30: "ONE_MONTH",
    60: "TWO_MONTHS",
    90: "THREE_MONTHS",
    180: "SIX_MONTHS",
    365: "ONE_YEAR",
}
DURATION_BY_MONTHS = {
    1: "ONE_MONTH",
    2: "TWO_MONTHS",
    3: "THREE_MONTHS",
    6: "SIX_MONTHS",
    12: "ONE_YEAR",
}
ALL_DURATIONS = sorted(set(DURATION_BY_DAYS.values()) | set(DURATION_BY_MONTHS.values()))


def _duration_from_days(days: int) -> str:
    if days not in DURATION_BY_DAYS:
        sys.exit(
            f"--days {days} is not an Apple SubscriptionOfferDuration. "
            f"Allowed day-counts: {sorted(DURATION_BY_DAYS)} "
            f"(={[DURATION_BY_DAYS[d] for d in sorted(DURATION_BY_DAYS)]})."
        )
    return DURATION_BY_DAYS[days]


def _duration_from_months(months: int) -> str:
    if months not in DURATION_BY_MONTHS:
        sys.exit(
            f"--months {months} is not an Apple SubscriptionOfferDuration. "
            f"Allowed months: {sorted(DURATION_BY_MONTHS)}. Offer codes max out at 6 months."
        )
    return DURATION_BY_MONTHS[months]


# --------------------------------------------------------------------------- auth


def _load_creds(args) -> dict:
    """Return {keyId, issuerId, p8}. Flags win; else AWS Secrets Manager."""
    if args.key_file or args.key_id or args.issuer_id:
        if not (args.key_file and args.key_id and args.issuer_id):
            sys.exit("Pass ALL of --key-file, --key-id, --issuer-id together (or none, to use Secrets Manager).")
        with open(args.key_file, "r") as f:
            p8 = f.read()
        return {"keyId": args.key_id, "issuerId": args.issuer_id, "p8": p8}

    try:
        import boto3
    except ImportError:
        sys.exit("boto3 not installed and no --key-file/--key-id/--issuer-id given. `pip install boto3` or pass the flags.")
    sm = boto3.client("secretsmanager")
    secret = json.loads(sm.get_secret_value(SecretId=args.secret_id)["SecretString"])
    asc = secret.get(SECRET_KEY)
    if not asc:
        sys.exit(
            f"Secret '{args.secret_id}' has no '{SECRET_KEY}' key yet.\n"
            f"Populate it with:\n"
            f'  {SECRET_KEY}: {{ "keyId": "<Key ID>", "issuerId": "<Issuer ID>", "p8": "<full .p8 PEM>" }}\n'
            f"(Get these from App Store Connect > Users and Access > Integrations > App Store Connect API.)"
        )
    if isinstance(asc, str):
        asc = json.loads(asc)
    for k in ("keyId", "issuerId", "p8"):
        if not asc.get(k):
            sys.exit(f"Secret '{args.secret_id}'.{SECRET_KEY} is missing '{k}'.")
    return asc


def _make_jwt(creds: dict) -> str:
    """ES256 JWT for the App Store Connect API. Never logged/printed."""
    try:
        import jwt  # PyJWT
    except ImportError:
        sys.exit("PyJWT not installed. `pip install pyjwt cryptography`.")
    now = int(time.time())
    payload = {
        "iss": creds["issuerId"],
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
        "aud": AUDIENCE,
        # Team-scoped (Issuer ID) keys want `iss`. Individual-API keys instead want
        # the subject claim. If you ever use an INDIVIDUAL key (no Issuer ID), drop
        # "iss" and add "sub": "user". Team keys (the norm) are fine as-is.
    }
    headers = {"alg": "ES256", "kid": creds["keyId"], "typ": "JWT"}
    return jwt.encode(payload, creds["p8"], algorithm="ES256", headers=headers)


class Client:
    """Thin App Store Connect REST client. Holds the JWT in memory only."""

    def __init__(self, creds: dict):
        try:
            import requests
        except ImportError:
            sys.exit("requests not installed. `pip install requests`.")
        self._requests = requests
        self._token = _make_jwt(creds)
        self._issued = time.time()
        self._creds = creds

    def _headers(self):
        # Refresh proactively if we're near the 20-min cap (long paginated runs).
        if time.time() - self._issued > JWT_TTL_SECONDS - 60:
            self._token = _make_jwt(self._creds)
            self._issued = time.time()
        return {"Authorization": f"Bearer {self._token}", "Content-Type": "application/json"}

    def get(self, path, params=None):
        url = path if path.startswith("http") else f"{BASE_URL}{path}"
        r = self._requests.get(url, headers=self._headers(), params=params, timeout=60)
        self._raise(r)
        return r.json()

    def get_all(self, path, params=None):
        """Follow JSON:API `links.next` pagination, returning the concatenated data."""
        out, page = [], self.get(path, params)
        out.extend(page.get("data", []))
        nxt = (page.get("links") or {}).get("next")
        while nxt:
            page = self.get(nxt)
            out.extend(page.get("data", []))
            nxt = (page.get("links") or {}).get("next")
        return out

    def post(self, path, body):
        url = f"{BASE_URL}{path}"
        r = self._requests.post(url, headers=self._headers(), data=json.dumps(body), timeout=60)
        self._raise(r)
        return r.json() if r.text else {}

    @staticmethod
    def _raise(r):
        if r.status_code >= 300:
            # ASC errors are a JSON:API `errors` array — surface them, not the JWT.
            try:
                errs = r.json().get("errors", [])
                detail = "; ".join(f"{e.get('status')} {e.get('title')}: {e.get('detail')}" for e in errs)
            except Exception:
                detail = r.text[:500]
            sys.exit(f"App Store Connect API {r.status_code}: {detail}")


# ------------------------------------------------------------------ app/sub lookup


def _app_id(c: Client) -> str:
    # GET /v1/apps?filter[bundleId]=com.corpora.corpan
    # Ref: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps
    data = c.get_all("/apps", {"filter[bundleId]": BUNDLE_ID})
    if not data:
        sys.exit(f"No app found for bundleId {BUNDLE_ID}. Check the team/bundle id.")
    return data[0]["id"]


def _subscriptions(c: Client, app_id: str):
    """Yield (group_id, subscription_resource) for every sub in every group.

    Apple nests: app -> subscriptionGroups -> subscriptions.
    Refs: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-subscriptiongroups
          https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptiongroups-_id_-subscriptions
    """
    groups = c.get_all(f"/apps/{app_id}/subscriptionGroups")
    for g in groups:
        gid = g["id"]
        for sub in c.get_all(f"/subscriptionGroups/{gid}/subscriptions"):
            yield gid, sub


def _resolve_subscription(c: Client, product_id: str) -> dict:
    """Find the subscription resource whose attributes.productId == product_id."""
    app_id = _app_id(c)
    for _gid, sub in _subscriptions(c, app_id):
        if (sub.get("attributes") or {}).get("productId") == product_id:
            return sub
    sys.exit(f"No subscription with productId '{product_id}'. Run `list` to see available product ids.")


# ------------------------------------------------------------------- price points


def list_price_points(c: Client, subscription_id: str, territory: str):
    """List a subscription's price points in one territory.

    GET /v1/subscriptions/{id}/pricePoints?filter[territory]=USA
    Apple now REQUIRES the territory filter on this endpoint. The returned
    subscriptionPricePoints[].id is what a paid offer/code references.
    Ref: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-pricepoints
    """
    return c.get_all(
        f"/subscriptions/{subscription_id}/pricePoints",
        {"filter[territory]": territory, "include": "territory", "limit": 200},
    )


def _territories(c: Client) -> list:
    """All App Store territory ids (e.g. 'USA', 'CAN', ...).
    Ref: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-territories
    """
    return [t["id"] for t in c.get_all("/territories", {"limit": 200})]


def _price_of(pp) -> float:
    """customerPrice of a (subscription)PricePoint resource, as a float (0.0 on miss).

    Apple price points expose `attributes.customerPrice` as a STRING decimal,
    e.g. "4.99" (USD), "490" (JPY, no minor unit). We compare these numerically.
    Confirmed shape: a price point's `attributes.customerPrice` is the customer-
    facing amount in the territory's currency.
    Ref: https://developer.apple.com/documentation/appstoreconnectapi/subscriptionpricepoint
    Working example (subscriptions/{id}/pricePoints?include=territory&filter[territory]=...):
      https://gist.github.com/astashov/79dd4ef4e91ea012710145623bfe0984
    """
    try:
        return float((pp.get("attributes") or {}).get("customerPrice") or 0)
    except (TypeError, ValueError):
        return 0.0


def subscription_prices(c: Client, subscription_id: str) -> dict:
    """Return {territoryId: base_customer_price (float)} — the sub's CURRENT price ladder.

    GET /v1/subscriptions/{id}/prices?include=subscriptionPricePoint,territory&limit=200
    Each `subscriptionPrices` resource links to ONE subscriptionPricePoint (the
    current price) and ONE territory. We read the price from the *included*
    subscriptionPricePoints (their `attributes.customerPrice`), keyed by the
    territory on the price relationship. This is the per-territory BASE that we
    discount against.
    Ref: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-prices
    (Background on the per-territory pricing model + equalizations:
     https://developer.apple.com/forums/thread/718915)
    """
    # We need the included resources too, so call .get (not get_all) and walk pages
    # ourselves, accumulating BOTH data and included.
    out, included = {}, {}
    page = c.get(
        f"/subscriptions/{subscription_id}/prices",
        {"include": "subscriptionPricePoint,territory", "limit": 200},
    )
    while True:
        for inc in page.get("included", []):
            included[(inc.get("type"), inc.get("id"))] = inc
        for price in page.get("data", []):
            rels = price.get("relationships") or {}
            terr = (((rels.get("territory") or {}).get("data")) or {}).get("id")
            pp_ref = ((rels.get("subscriptionPricePoint") or {}).get("data")) or {}
            pp = included.get((pp_ref.get("type"), pp_ref.get("id")))
            if terr and pp is not None:
                out[terr] = _price_of(pp)
        nxt = (page.get("links") or {}).get("next")
        if not nxt:
            break
        page = c.get(nxt)
    return out


def price_points(c: Client, subscription_id: str, territory: str) -> list:
    """The price-point LADDER for one territory: [{"id":..., "price": float}, ...].

    Thin typed wrapper over list_price_points (GET .../pricePoints?filter[territory]=T,
    paginated). Apple REQUIRES filter[territory] here, and the ladder is returned
    per-territory (you cannot fetch all territories' points at once).
    """
    return [{"id": pp["id"], "price": _price_of(pp)} for pp in list_price_points(c, subscription_id, territory)]


def nearest_point(points: list, target: float) -> dict:
    """Pick the price point closest to `target` (prefer the largest point <= target).

    `points` = [{"id":..., "price": float}, ...]. Strategy:
      - Among points whose price is <= target (a real discount that doesn't UNDERcut
        the intended amount upward), take the HIGHEST — the best-value point at/under
        the target.
      - If none are <= target (target below the cheapest rung), fall back to the
        globally nearest point by absolute distance.
    Returns the chosen {"id","price"} dict (or {} if `points` is empty).

    Rationale: Apple realizes discounts only by binding to a fixed price point; "30%
    off" therefore means "the rung nearest 0.70 x base", an approximation bounded by
    the ladder granularity (Apple has ~800 rungs/currency, so it's usually very close).
    """
    priced = [p for p in points if p.get("price", 0) > 0]
    if not priced:
        return {}
    at_or_below = [p for p in priced if p["price"] <= target + 1e-9]
    if at_or_below:
        return max(at_or_below, key=lambda p: p["price"])
    return min(priced, key=lambda p: abs(p["price"] - target))


# --------------------------------------------------------------------------- list


def cmd_list(args):
    c = Client(_load_creds(args))
    app_id = _app_id(c)
    print(f"app {BUNDLE_ID} -> id {app_id}")
    any_sub = False
    for gid, sub in _subscriptions(c, app_id):
        any_sub = True
        sid = sub["id"]
        a = sub.get("attributes") or {}
        print(f"\n=== subscription: {a.get('productId')}  ({a.get('name')})  [group {gid}] ===")
        print(f"    id={sid}  state={a.get('state')}  period={a.get('subscriptionPeriod')}")

        # Introductory offers on this subscription.
        # GET /v1/subscriptions/{id}/introductoryOffers
        # Ref: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-introductoryoffers
        try:
            offers = c.get_all(f"/subscriptions/{sid}/introductoryOffers", {"include": "territory", "limit": 200})
        except SystemExit:
            offers = []
        if offers:
            print(f"    introductory offers ({len(offers)}):")
            for off in offers:
                oa = off.get("attributes") or {}
                terr = ((off.get("relationships") or {}).get("territory") or {}).get("data") or {}
                print(f"      - {oa.get('offerMode')} {oa.get('duration')} x{oa.get('numberOfPeriods')}"
                      f"  territory={terr.get('id')}  [{oa.get('startDate')}..{oa.get('endDate')}]")
        else:
            print("    introductory offers: (none)")

        # Offer codes on this subscription.
        # GET /v1/subscriptions/{id}/offerCodes
        # Ref: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-offercodes
        try:
            codes = c.get_all(f"/subscriptions/{sid}/offerCodes", {"limit": 200})
        except SystemExit:
            codes = []
        if codes:
            print(f"    offer codes ({len(codes)}):")
            for oc in codes:
                ca = oc.get("attributes") or {}
                print(f"      - '{ca.get('name')}'  {ca.get('offerMode')} {ca.get('duration')} x{ca.get('numberOfPeriods')}"
                      f"  eligible={ca.get('customerEligibilities')}  active={ca.get('active')}  id={oc['id']}")
                # one-time-use code batches
                # GET /v1/subscriptionOfferCodes/{id}/oneTimeUseCodes
                try:
                    batches = c.get_all(f"/subscriptionOfferCodes/{oc['id']}/oneTimeUseCodes", {"limit": 50})
                except SystemExit:
                    batches = []
                for b in batches:
                    ba = b.get("attributes") or {}
                    print(f"          one-time batch: {ba.get('numberOfCodes')} codes, expires {ba.get('expirationDate')}, active={ba.get('active')}")
                # custom (reusable) codes
                # GET /v1/subscriptionOfferCodes/{id}/customCodes
                try:
                    customs = c.get_all(f"/subscriptionOfferCodes/{oc['id']}/customCodes", {"limit": 50})
                except SystemExit:
                    customs = []
                for cm in customs:
                    ma = cm.get("attributes") or {}
                    print(f"          custom code: '{ma.get('customCode')}' x{ma.get('numberOfCodes')} expires {ma.get('expirationDate')} active={ma.get('active')}")
        else:
            print("    offer codes: (none)")
    if not any_sub:
        print("\n(no subscriptions found — create corpan.sub.monthly / corpan.sub.annual in App Store Connect first)")


def cmd_pricepoints(args):
    c = Client(_load_creds(args))
    sub = _resolve_subscription(c, args.product)
    pps = list_price_points(c, sub["id"], args.territory)
    if not pps:
        print(f"(no price points for {args.product} in territory {args.territory})")
        return
    print(f"price points for {args.product} in {args.territory}:")
    for pp in pps:
        a = pp.get("attributes") or {}
        print(f"  id={pp['id']}  customerPrice={a.get('customerPrice')}  proceeds={a.get('proceeds')}")


# --------------------------------------------------------------------------- trial


def _intro_offer_body(subscription_id, duration, number_of_periods, territory_id,
                      price_point_id=None, start_date=None, end_date=None):
    """One subscriptionIntroductoryOffer create body, scoped to ONE territory.

    Ref: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-subscriptionintroductoryoffers
    Schema: SubscriptionIntroductoryOfferCreateRequest
      attributes: duration (SubscriptionOfferDuration), offerMode (SubscriptionOfferMode),
                  numberOfPeriods (Int), startDate?, endDate?
      relationships: subscription (REQUIRED), territory?, subscriptionPricePoint?
    For offerMode=FREE_TRIAL there is no price, so we send subscription + territory and
    OMIT subscriptionPricePoint. (For PAY_AS_YOU_GO/PAY_UP_FRONT you MUST also include a
    subscriptionPricePoint relationship — resolve its id via `pricepoints`.)
    """
    rels = {
        "subscription": {"data": {"type": "subscriptions", "id": subscription_id}},
        "territory": {"data": {"type": "territories", "id": territory_id}},
    }
    if price_point_id:
        rels["subscriptionPricePoint"] = {
            "data": {"type": "subscriptionPricePoints", "id": price_point_id}
        }
    attrs = {
        "duration": duration,        # SubscriptionOfferDuration enum
        "offerMode": "FREE_TRIAL",   # SubscriptionOfferMode enum
        "numberOfPeriods": number_of_periods,  # how many durations the offer repeats
    }
    if start_date:
        attrs["startDate"] = start_date  # "YYYY-MM-DD"
    if end_date:
        attrs["endDate"] = end_date
    return {"data": {"type": "subscriptionIntroductoryOffers", "attributes": attrs, "relationships": rels}}


def cmd_trial(args):
    """Create a FREE_TRIAL introductory offer.

    IMPORTANT — Apple intro offers are PER-TERRITORY. Despite the create request
    accepting an `included` array of price points, that array does NOT batch the
    offer across territories (devs report it has "no effect"; the documented path is
    one POST per territory — see
    https://developer.apple.com/forums/thread/759596). So to cover "all territories"
    we enumerate /v1/territories and POST one offer per territory. A FREE_TRIAL needs
    NO price point, so the only per-territory variation is the territory id itself.
    """
    duration = _duration_from_days(args.days)
    c = Client(_load_creds(args))
    sub = _resolve_subscription(c, args.product)
    sid = sub["id"]

    territories = list(args.territories) if args.territories else _territories(c)
    print(f"FREE_TRIAL intro offer on {args.product} (id {sid}): "
          f"duration={duration} numberOfPeriods={args.periods} over {len(territories)} territories")
    # Show ONE representative body in full (they differ only by territory id).
    sample = _intro_offer_body(sid, duration, args.periods, territories[0],
                               start_date=args.start_date, end_date=args.end_date)
    print("\nrepresentative request body (POST /v1/subscriptionIntroductoryOffers):")
    print(json.dumps(sample, indent=2))
    if not args.territories:
        print(f"\n(...repeated for all {len(territories)} territories: {', '.join(territories[:8])}...)")

    if not args.yes:
        print("\n[dry-run] add --yes to create the offer(s).")
        return

    created, failed = 0, []
    for terr in territories:
        body = _intro_offer_body(sid, duration, args.periods, terr,
                                 start_date=args.start_date, end_date=args.end_date)
        try:
            c.post("/subscriptionIntroductoryOffers", body)
            created += 1
        except SystemExit as e:
            # Don't abort the whole run on one territory (e.g. already exists / not sold there).
            failed.append((terr, str(e)))
    print(f"\ncreated {created}/{len(territories)} territory offers.")
    if failed:
        print(f"{len(failed)} failed (often: offer already exists / sub not sold there):")
        for terr, msg in failed[:10]:
            print(f"  {terr}: {msg}")


# ---------------------------------------------------------------------- offer codes


def _offer_code_prices_included(territory_price_points):
    """Build the `included` array of inline subscriptionOfferCodePrices.

    Each offer code carries a PRICE per territory it's offered in (even FREE codes
    reference a price point — Apple resolves the discounted/zero amount from it).
    SubscriptionOfferCodePriceInlineCreate:
      type: subscriptionOfferCodePrices
      id:   a client-chosen LOCAL id ("${pp}") used only to wire the relationship
      relationships: territory (territories), subscriptionPricePoint (subscriptionPricePoints)
    Ref: https://developer.apple.com/documentation/appstoreconnectapi/subscriptionoffercodepriceinlinecreate
    """
    included, rel_data = [], []
    for territory_id, price_point_id in territory_price_points:
        local_id = f"${{price-{territory_id}}}"  # placeholder id linking included<->relationship
        rels = {"territory": {"data": {"type": "territories", "id": territory_id}}}
        # FREE_TRIAL codes must NOT bind a price point (Apple 409s:
        # "For FREE_TRIAL offerMode, subscriptionPricePoint must be null").
        # PAY_AS_YOU_GO / PAY_UP_FRONT bind the resolved point.
        if price_point_id is not None:
            rels["subscriptionPricePoint"] = {"data": {"type": "subscriptionPricePoints", "id": price_point_id}}
        included.append({
            "type": "subscriptionOfferCodePrices",
            "id": local_id,
            "relationships": rels,
        })
        rel_data.append({"type": "subscriptionOfferCodePrices", "id": local_id})
    return included, rel_data


def _offer_code_body(subscription_id, name, customer_eligibilities, offer_mode,
                     duration, number_of_periods, included, rel_data):
    """subscriptionOfferCodes create body.

    Ref: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-subscriptionoffercodes
    Schema: SubscriptionOfferCodeCreateRequest
      attributes: name (your internal reference), customerEligibilities [NEW|EXISTING|EXPIRED],
                  offerEligibility (STACK_WITH_INTRO_OFFERS|REPLACE_INTRO_OFFERS),
                  offerMode (FREE_TRIAL|PAY_AS_YOU_GO|PAY_UP_FRONT), duration, numberOfPeriods
      relationships: subscription (REQUIRED), prices (-> subscriptionOfferCodePrices, REQUIRED)
      included: [SubscriptionOfferCodePriceInlineCreate]
    """
    return {
        "data": {
            "type": "subscriptionOfferCodes",
            "attributes": {
                "name": name,
                "customerEligibilities": customer_eligibilities,  # list, e.g. ["NEW","EXPIRED"]
                "offerEligibility": "STACK_WITH_INTRO_OFFERS",     # stack atop any intro offer
                "offerMode": offer_mode,
                "duration": duration,
                "numberOfPeriods": number_of_periods,
            },
            "relationships": {
                "subscription": {"data": {"type": "subscriptions", "id": subscription_id}},
                "prices": {"data": rel_data},
            },
        },
        "included": included,
    }


def _one_time_use_body(offer_code_id, count, expiration_date):
    """subscriptionOfferCodeOneTimeUseCodes create body (a BATCH of single-use codes).

    Ref: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-subscriptionoffercodeonetimeusecodes
    Schema: SubscriptionOfferCodeOneTimeUseCodeCreateRequest
      attributes: numberOfCodes (Int), expirationDate (ISO-8601 "YYYY-MM-DD")
      relationships: offerCode (-> subscriptionOfferCodes)
    Apple limits: a one-time-use batch expires at most 6 MONTHS out.
    """
    return {
        "data": {
            "type": "subscriptionOfferCodeOneTimeUseCodes",
            "attributes": {"numberOfCodes": count, "expirationDate": expiration_date},
            "relationships": {"offerCode": {"data": {"type": "subscriptionOfferCodes", "id": offer_code_id}}},
        }
    }


def _custom_code_body(offer_code_id, custom_code, count, expiration_date=None):
    """subscriptionOfferCodeCustomCodes create body (a REUSABLE your-string code).

    Ref: https://developer.apple.com/documentation/appstoreconnectapi/post-v1-subscriptionoffercodecustomcodes
    Schema: SubscriptionOfferCodeCustomCodeCreateRequest
      attributes: customCode (your string), numberOfCodes (max redemptions), expirationDate?
      relationships: offerCode (-> subscriptionOfferCodes)
    Custom codes are in-app redemption only (not the App Store redeem sheet).
    """
    attrs = {"customCode": custom_code, "numberOfCodes": count}
    if expiration_date:
        attrs["expirationDate"] = expiration_date
    return {
        "data": {
            "type": "subscriptionOfferCodeCustomCodes",
            "attributes": attrs,
            "relationships": {"offerCode": {"data": {"type": "subscriptionOfferCodes", "id": offer_code_id}}},
        }
    }


def _resolve_price_points(c: Client, subscription_id, territories):
    """For each territory, pick the BASE (highest, i.e. undiscounted) price point id.

    An offer code's `prices` reference real subscriptionPricePoints; Apple derives the
    free/discounted amount from offerMode + duration relative to this base price point.
    We pick the costliest point per territory as the canonical "full price" anchor.
    """
    out = []
    for terr in territories:
        pps = list_price_points(c, subscription_id, terr)
        if not pps:
            continue
        def price_of(pp):
            try:
                return float((pp.get("attributes") or {}).get("customerPrice") or 0)
            except (TypeError, ValueError):
                return 0.0
        out.append((terr, max(pps, key=price_of)["id"]))
    if not out:
        sys.exit("Could not resolve any price points. Run `pricepoints` to inspect, and check the territory list.")
    return out


def _six_months_out_iso():
    return (dt.date.today() + dt.timedelta(days=180)).isoformat()  # "YYYY-MM-DD"


def cmd_code_free(args):
    """Create a FREE offer code + a one-time-use code batch (CSV out)."""
    duration = _duration_from_months(args.months)
    c = Client(_load_creds(args))
    sub = _resolve_subscription(c, args.product)
    sid = sub["id"]
    name = args.name or f"free-{args.months}mo"
    territories = list(args.territories) if args.territories else _territories(c)

    # A FREE code carries no price, so it binds NO price point — just the
    # territories it's offered in (each with a null price point).
    tpp = [(terr, None) for terr in territories]
    included, rel_data = _offer_code_prices_included(tpp)
    code_body = _offer_code_body(
        sid, name, customer_eligibilities=["NEW", "EXPIRED"], offer_mode="FREE_TRIAL",
        duration=duration, number_of_periods=args.periods, included=included, rel_data=rel_data,
    )
    expiration = args.expires or _six_months_out_iso()
    print(f"FREE offer code '{name}' on {args.product}: {duration} x{args.periods}, "
          f"{len(tpp)} territories priced; one-time batch of {args.count} codes, expires {expiration}")
    print("\n1) POST /v1/subscriptionOfferCodes:")
    print(json.dumps(code_body, indent=2))
    print(f"\n2) POST /v1/subscriptionOfferCodeOneTimeUseCodes (after the code id is known):")
    print(json.dumps(_one_time_use_body("<offerCodeId>", args.count, expiration), indent=2))

    if not args.yes:
        print("\n[dry-run] add --yes to create the offer code + the one-time batch.")
        return

    created = c.post("/subscriptionOfferCodes", code_body)
    oc_id = created["data"]["id"]
    print(f"\ncreated offer code id={oc_id}")
    batch = c.post("/subscriptionOfferCodeOneTimeUseCodes", _one_time_use_body(oc_id, args.count, expiration))
    batch_id = batch["data"]["id"]
    print(f"created one-time-use batch id={batch_id} ({args.count} codes)")
    _download_one_time_codes(c, batch_id, args.csv or f"{name}-codes.csv")


def _download_one_time_codes(c: Client, batch_id, out_path):
    """Fetch the generated single-use codes (CSV) and write them locally.

    GET /v1/subscriptionOfferCodeOneTimeUseCodes/{id}/values returns a text/csv body.
    Ref: https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptionoffercodeonetimeusecodes-_id_-values
    """
    url = f"{BASE_URL}/subscriptionOfferCodeOneTimeUseCodes/{batch_id}/values"
    r = c._requests.get(url, headers={"Authorization": c._headers()["Authorization"]}, timeout=120)
    if r.status_code >= 300:
        print(f"(could not download codes CSV: HTTP {r.status_code}; fetch later from {url})")
        return
    with open(out_path, "w", newline="") as f:
        f.write(r.text)
    # Count non-empty data rows for a friendly summary (don't print the codes themselves).
    rows = sum(1 for row in csv.reader(io.StringIO(r.text)) if row) - 1
    print(f"wrote {max(rows, 0)} codes -> {out_path}")


def _resolve_discount_points(c: Client, subscription_id, territories, percent_off, single_price_point=None):
    """For each territory, pick the price-point id nearest (1 - percent/100) x base.

    Returns (resolved, skipped, rows) where:
      resolved : [(territoryId, pricePointId), ...]  — for the offer-code `prices`
      skipped  : [(territoryId, reason), ...]        — territories we couldn't price
      rows     : [(territoryId, base, target, chosenId, chosenPrice), ...] for printing
    Per-territory failures (no current price / no ladder / no rung) SKIP, never abort
    (mirrors cmd_trial). `single_price_point` (only valid for a single territory) is an
    explicit override that bypasses resolution and is reported as base==chosen.
    """
    frac = 1.0 - (percent_off / 100.0)

    # One read of the CURRENT base price per territory (single paginated call).
    base_by_terr = subscription_prices(c, subscription_id)

    resolved, skipped, rows = [], [], []
    for terr in territories:
        if single_price_point and len(territories) == 1:
            resolved.append((terr, single_price_point))
            base = base_by_terr.get(terr, 0.0)
            rows.append((terr, base, base * frac, single_price_point, None))
            continue
        base = base_by_terr.get(terr)
        if not base:
            skipped.append((terr, "no current base price (sub not priced here)"))
            continue
        ladder = price_points(c, subscription_id, terr)
        if not ladder:
            skipped.append((terr, "no price-point ladder"))
            continue
        target = base * frac
        chosen = nearest_point(ladder, target)
        if not chosen:
            skipped.append((terr, "no usable price point"))
            continue
        resolved.append((terr, chosen["id"]))
        rows.append((terr, base, target, chosen["id"], chosen["price"]))
    return resolved, skipped, rows


def cmd_code_discount(args):
    """Create a discounted (PAY_AS_YOU_GO) offer code + a custom reusable code.

    The discount is REAL and per-territory: for each territory we read the current
    base price and bind the price point nearest (1 - percent/100) x base. Apple has
    no raw "% off" — a discount is always one of Apple's fixed price-point rungs — so
    "30% off" = the rung nearest 0.70 x base in THAT territory (a close approximation).
    """
    # Apple custom codes: UPPERCASE alphanumeric only, minimum 4 characters.
    # Normalize + validate up front so we don't create the offer-code config and
    # then 409 on the custom-code attach (leaving a dangling empty config).
    args.code = args.code.strip().upper()
    if len(args.code) < 4 or not all(ch.isascii() and ch.isalnum() for ch in args.code):
        sys.exit(f"Apple custom code '{args.code}' is invalid: must be UPPERCASE "
                 f"alphanumeric, minimum 4 characters.")
    duration = _duration_from_months(args.months) if args.months else "ONE_MONTH"
    c = Client(_load_creds(args))
    sub = _resolve_subscription(c, args.product)
    sid = sub["id"]
    name = args.name or f"discount-{args.percent_off}off-{args.code}"
    territories = list(args.territories) if args.territories else _territories(c)

    if args.price_point and len(territories) != 1:
        sys.exit("--price-point is an explicit single-territory override; pass exactly one --territories with it.")

    resolved, skipped, rows = _resolve_discount_points(
        c, sid, territories, args.percent_off, single_price_point=args.price_point
    )
    if not resolved:
        sys.exit("Could not resolve a discounted price point in ANY territory. "
                 "Run `pricepoints --territory USA` and check the subscription is priced.")

    # READ-ONLY sanity check: show the resolution table. Always print USA first (the
    # integrator's reference), then a couple more so dry-run shows REAL resolved ids.
    rows_sorted = sorted(rows, key=lambda r: (r[0] != "USA", r[0]))
    print(f"DISCOUNT offer code '{name}' on {args.product}: PAY_AS_YOU_GO {duration} x{args.periods}; "
          f"~{args.percent_off}% off, REAL per-territory price points.")
    print(f"resolved {len(resolved)}/{len(territories)} territories ({len(skipped)} skipped).")
    print("\nprice-point resolution (territory: base -> target(~{}% off) -> chosen point):".format(args.percent_off))
    for terr, base, target, chosen_id, chosen_price in rows_sorted[:6]:
        if chosen_price is None:  # explicit --price-point override
            print(f"  {terr}: base={base}  (override) point={chosen_id}")
        else:
            eff = (1 - chosen_price / base) * 100 if base else 0
            print(f"  {terr}: base={base}  target={target:.2f}  ->  point={chosen_id}  price={chosen_price}  (actual -{eff:.0f}%)")
    if len(rows_sorted) > 6:
        print(f"  ... ({len(rows_sorted) - 6} more territories resolved)")
    if skipped:
        print(f"\nskipped {len(skipped)} territories (not priced / no rung):")
        for terr, why in skipped[:10]:
            print(f"  {terr}: {why}")

    included, rel_data = _offer_code_prices_included(resolved)
    code_body = _offer_code_body(
        sid, name, customer_eligibilities=["NEW", "EXISTING", "EXPIRED"], offer_mode="PAY_AS_YOU_GO",
        duration=duration, number_of_periods=args.periods, included=included, rel_data=rel_data,
    )
    custom_body = _custom_code_body("<offerCodeId>", args.code, args.max_uses, args.expires)
    print("\n1) POST /v1/subscriptionOfferCodes (showing first 3 territories' resolved price points):")
    print(json.dumps(_truncate_offer_body_for_print(code_body, 3), indent=2))
    print("\n2) POST /v1/subscriptionOfferCodeCustomCodes (after the code id is known):")
    print(json.dumps(custom_body, indent=2))

    if not args.yes:
        print("\n[dry-run] add --yes to create the offer code + the custom code.")
        return

    created = c.post("/subscriptionOfferCodes", code_body)
    oc_id = created["data"]["id"]
    print(f"\ncreated offer code id={oc_id} ({len(resolved)} territories priced)")
    custom = c.post("/subscriptionOfferCodeCustomCodes", _custom_code_body(oc_id, args.code, args.max_uses, args.expires))
    print(f"created custom code '{args.code}' id={custom['data']['id']} (in-app redemption only)")


def _truncate_offer_body_for_print(body, n):
    """A copy of the offer-code body showing only the first n territories' inline
    prices (the full body can be ~175 entries). Resolved ids are REAL, not redacted."""
    import copy
    b = copy.deepcopy(body)
    inc = b.get("included", [])
    rel = (((b.get("data") or {}).get("relationships") or {}).get("prices") or {}).get("data", [])
    if len(inc) > n:
        b["included"] = inc[:n] + [f"... (+{len(inc) - n} more territories)"]
    if len(rel) > n:
        b["data"]["relationships"]["prices"]["data"] = rel[:n] + [f"... (+{len(rel) - n} more)"]
    return b


# ---------------------------------------------------------------------------- main


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--key-file", help="local ASC API .p8 private key (use WITH --key-id --issuer-id)")
    p.add_argument("--key-id", help="ASC API Key ID (use WITH --key-file --issuer-id)")
    p.add_argument("--issuer-id", help="ASC API Issuer ID (use WITH --key-file --key-id)")
    p.add_argument("--secret-id", default=DEFAULT_SECRET_ID,
                   help=f"AWS secret holding the '{SECRET_KEY}' creds (default {DEFAULT_SECRET_ID})")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("list", help="read-only: app -> groups -> subs -> intro offers + offer codes")
    sp.set_defaults(func=cmd_list)

    sp = sub.add_parser("pricepoints", help="read-only: list a subscription's price points for a territory")
    sp.add_argument("--product", required=True, help="subscription productId, e.g. corpan.sub.monthly")
    sp.add_argument("--territory", default="USA", help="territory id (default USA)")
    sp.set_defaults(func=cmd_pricepoints)

    sp = sub.add_parser("trial", help="create a FREE_TRIAL introductory offer (per-territory)")
    sp.add_argument("--product", required=True)
    sp.add_argument("--days", type=int, default=7,
                    help=f"trial length; must map to a SubscriptionOfferDuration {sorted(DURATION_BY_DAYS)}")
    sp.add_argument("--periods", type=int, default=1, help="numberOfPeriods (how many durations; default 1)")
    sp.add_argument("--territories", nargs="*", help="territory ids to target (default: ALL territories)")
    sp.add_argument("--start-date", help="YYYY-MM-DD (optional)")
    sp.add_argument("--end-date", help="YYYY-MM-DD (optional)")
    sp.add_argument("--yes", action="store_true", help="actually POST (default dry-run)")
    sp.set_defaults(func=cmd_trial)

    sp = sub.add_parser("code-free", help="create a FREE offer code + a one-time-use code batch (CSV)")
    sp.add_argument("--product", required=True)
    sp.add_argument("--count", type=int, required=True, help="number of single-use codes to generate")
    sp.add_argument("--months", type=int, default=1, help=f"free duration in months {sorted(DURATION_BY_MONTHS)} (<=6)")
    sp.add_argument("--periods", type=int, default=1, help="numberOfPeriods (default 1)")
    sp.add_argument("--name", help="internal reference name (default free-<months>mo)")
    sp.add_argument("--territories", nargs="*", help="territory ids (default: ALL)")
    sp.add_argument("--expires", help="batch expiration YYYY-MM-DD (default ~6 months out; Apple cap)")
    sp.add_argument("--csv", help="output CSV path for the generated codes (default <name>-codes.csv)")
    sp.add_argument("--yes", action="store_true", help="actually POST (default dry-run)")
    sp.set_defaults(func=cmd_code_free)

    sp = sub.add_parser(
        "code-discount",
        help="create a REAL %%-off PAY_AS_YOU_GO offer code (per-territory price point) + a custom reusable code",
        description=(
            "Create a custom (reusable) offer code that gives a REAL percentage discount in EVERY\n"
            "territory. Apple has no raw '% off': a discount is one of Apple's fixed price-point rungs.\n"
            "So for each territory we read the CURRENT base price and bind the rung nearest\n"
            "(1 - percent/100) x base (a close approximation, ~800 rungs/currency).\n\n"
            "offerMode = PAY_AS_YOU_GO: the discounted price is charged each period for --periods periods,\n"
            "where each period is --months long. So shape the deal with --months (period length) and\n"
            "--periods (how many periods):\n"
            "  '30% off for 12 months'  (monthly sub) -> --months 1  --periods 12  (12 monthly periods)\n"
            "  '30% off the first year' (annual sub)   -> --months 12 --periods 1   (one 1-year period)\n"
            "  '50% off first 3 months' (monthly sub)  -> --months 1  --periods 3\n"
            "customerEligibilities defaults to NEW,EXISTING,EXPIRED (affiliate codes work for everyone)."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    sp.add_argument("--product", required=True, help="subscription productId, e.g. corpan.sub.monthly")
    sp.add_argument("--code", required=True, help="the custom code string (e.g. IAN) for affiliate attribution")
    sp.add_argument("--percent-off", type=int, required=True,
                    help="REAL discount %% off the per-territory base (realized via the nearest price-point rung)")
    sp.add_argument("--periods", type=int, default=1,
                    help="numberOfPeriods the discounted price is charged (PAY_AS_YOU_GO). E.g. 12 for '30%% off 12 months'")
    sp.add_argument("--months", type=int,
                    help=f"LENGTH of each billing period in months {sorted(DURATION_BY_MONTHS)} "
                         f"(default 1). Use --months 1 --periods 12 for a monthly sub; --months 12 --periods 1 for annual")
    sp.add_argument("--max-uses", type=int, default=2000, help="max redemptions for the custom code (default 2000)")
    sp.add_argument("--price-point",
                    help="explicit subscriptionPricePoint id override; ONLY valid with a single --territories")
    sp.add_argument("--name", help="internal reference name")
    sp.add_argument("--territories", nargs="*", help="territory ids (default: ALL territories)")
    sp.add_argument("--expires", help="custom code expiration YYYY-MM-DD (optional)")
    sp.add_argument("--yes", action="store_true", help="actually POST (default dry-run)")
    sp.set_defaults(func=cmd_code_discount)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
