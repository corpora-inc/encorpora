"""Validate campaign copy and create new, paused Google Search campaigns.

No command enables delivery or changes existing campaigns. Operator configuration,
credentials, reports and account IDs belong outside the public repository.
"""

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import date
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pathlib import Path
from urllib.parse import urlparse


def validate(spec):
    if not re.fullmatch(r"[a-z0-9-]{1,64}", spec.get("id", "")):
        raise ValueError("id must be a stable lowercase slug")
    if spec.get("status") != "PAUSED":
        raise ValueError("Only PAUSED specifications are accepted")
    if spec.get("state") != "Arkansas":
        raise ValueError("This workbench targets Arkansas")
    for k in ["daily_budget_micros", "max_cpc_micros"]:
        if type(spec.get(k)) is not int or spec[k] <= 0:
            raise ValueError(f"{k} must be a positive integer")
    if not spec.get("ad_groups"):
        raise ValueError("At least one ad group is required")
    names = set()
    for g in spec["ad_groups"]:
        if not re.fullmatch(r"[a-z0-9-]{1,40}", g.get("id", "")) or g["id"] in names:
            raise ValueError("Ad group IDs must be unique slugs")
        names.add(g["id"])
        url = urlparse(g.get("url", ""))
        if (
            url.scheme != "https"
            or url.hostname not in ["corpora.inc", "amp.corpora.inc"]
            or url.username
            or url.password
        ):
            raise ValueError("Destination must be an HTTPS Corpora product URL")
        for key, lo, hi, length in [
            ("headlines", 3, 15, 30),
            ("descriptions", 2, 4, 90),
        ]:
            items = g.get(key, [])
            if not lo <= len(items) <= hi or len(set(items)) != len(items):
                raise ValueError(f"{key}: invalid count or duplicates")
            if any(
                not isinstance(s, str)
                or not s.strip()
                or len(s) > length
                or re.search(r"[\x00-\x1f]", s)
                for s in items
            ):
                raise ValueError(
                    f"{key}: empty, control characters, or over {length} characters"
                )
        if not g.get("keywords"):
            raise ValueError("Keywords required")
        for k in g["keywords"]:
            if (
                k.get("match") not in ["EXACT", "PHRASE"]
                or not 0 < len(k.get("text", "")) <= 80
            ):
                raise ValueError("Use nonempty exact or phrase keywords")
    for text in spec.get("negative_keywords", []):
        if not isinstance(text, str) or not 0 < len(text) <= 80:
            raise ValueError("Invalid negative keyword")
    return spec


def fingerprint(spec):
    return hashlib.sha256(
        json.dumps(spec, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def client_from_config(config):
    from google.ads.googleads.client import GoogleAdsClient
    from google.oauth2.credentials import Credentials

    if config["customer_id"] not in config["allowed_customer_ids"]:
        raise ValueError("Customer is not allowlisted")
    if not re.fullmatch(r"\d{10}", config["customer_id"]):
        raise ValueError("Invalid customer ID")
    cred = Credentials.from_authorized_user_file(
        str(Path(config["credentials"]).expanduser())
    )
    # Current SDK supports project-based access; legacy tokens are optional.
    return GoogleAdsClient(
        credentials=cred,
        developer_token=os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN"),
        login_customer_id=config.get("login_customer_id"),
        use_proto_plus=True,
        version="v26",
    )


def rows(client, cid, query):
    return list(
        client.get_service("GoogleAdsService").search(customer_id=cid, query=query)
    )


def report_dates(since, until):
    try:
        start, end = date.fromisoformat(since), date.fromisoformat(until)
    except (TypeError, ValueError):
        raise ValueError("Use --since and --until as ISO dates YYYY-MM-DD") from None
    if start.isoformat() != since or end.isoformat() != until or start > end or (end - start).days > 92:
        raise ValueError("Use an inclusive ISO date range of at most 93 days")
    return {"since": since, "until": until, "inclusive": True}


def report(client, cid, since, until):
    window = report_dates(since, until)
    account = rows(client, cid, "SELECT customer.id,customer.currency_code,customer.time_zone FROM customer")
    if len(account) != 1 or str(account[0].customer.id) != cid or account[0].customer.currency_code != "USD":
        raise ValueError("Report account identity or currency mismatch")
    timezone = account[0].customer.time_zone
    try:
        if not timezone:
            raise ValueError("Missing account time zone")
        ZoneInfo(timezone)
    except (ValueError, ZoneInfoNotFoundError):
        raise ValueError("Report requires a valid account time zone") from None
    query = (
        "SELECT campaign.id,campaign.name,campaign.status,ad_group.id,ad_group.name,ad_group.status,"
        "segments.date,metrics.impressions,metrics.clicks,metrics.cost_micros,"
        "metrics.conversions,metrics.conversions_value FROM ad_group "
        f"WHERE segments.date BETWEEN '{since}' AND '{until}' "
        "AND campaign.name LIKE 'AMP | AR | %' "
        "AND campaign.status IN ('ENABLED','PAUSED','REMOVED') "
        "AND ad_group.status IN ('ENABLED','PAUSED','REMOVED') "
        "ORDER BY segments.date,campaign.id,ad_group.id"
    )
    found = rows(client, cid, query)
    for row in found:
        if not row.campaign.name.startswith("AMP | AR | ") or not since <= row.segments.date <= until:
            raise ValueError("Report row is outside the requested campaign/date scope")
    return {
        "api_version": "v26", "customer_id": cid, "currency": "USD", "timezone": timezone,
        "date_range": window, "query": query,
        "rows": [{
            "campaign": {"id": str(row.campaign.id), "name": row.campaign.name, "status": row.campaign.status.name},
            "ad_group": {"id": str(row.ad_group.id), "name": row.ad_group.name, "status": row.ad_group.status.name},
            "segments": {"date": row.segments.date},
            "metrics": {
                "impressions": str(row.metrics.impressions), "clicks": str(row.metrics.clicks),
                "cost_micros": str(row.metrics.cost_micros), "conversions": row.metrics.conversions,
                "conversions_value": row.metrics.conversions_value,
            },
        } for row in found],
        "interpretation": (
            "Daily ad-group metrics for campaigns named AMP | AR | ..., in the advertiser time zone. "
            "Cost is integer micros of USD (1,000,000 per dollar). Conversions/value are platform-attributed "
            "using configured action windows and interaction dates, not verified EFA settlement or net cash. "
            "Recent attribution can change. Empty rows do not prove working tracking. "
            "AMP cash evidence uses UTC dates; align time boundaries before comparing periods. "
            "Campaign/ad-group names are configuration labels, not verified ad-click attribution."
        ),
    }


def campaign_name(spec):
    return "AMP | AR | " + spec["id"] + " | " + fingerprint(spec)[:12]


def build_operations(spec, cid, geo):
    """One atomic mutate batch. Temporary names connect all new resources."""
    budget = f"customers/{cid}/campaignBudgets/-1"
    campaign = f"customers/{cid}/campaigns/-2"
    name = campaign_name(spec)
    ops = [
        {
            "campaign_budget_operation": {
                "create": {
                    "resource_name": budget,
                    "name": name,
                    "amount_micros": spec["daily_budget_micros"],
                    "delivery_method": "STANDARD",
                    "explicitly_shared": False,
                }
            }
        },
        {
            "campaign_operation": {
                "create": {
                    "resource_name": campaign,
                    "name": name,
                    "advertising_channel_type": "SEARCH",
                    "status": "PAUSED",
                    "campaign_budget": budget,
                    "manual_cpc": {},
                    "contains_eu_political_advertising": "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
                    "network_settings": {
                        "target_google_search": True,
                        "target_search_network": False,
                        "target_content_network": False,
                        "target_partner_search_network": False,
                    },
                    "geo_target_type_setting": {
                        "positive_geo_target_type": "PRESENCE",
                        "negative_geo_target_type": "PRESENCE",
                    },
                }
            }
        },
        {
            "campaign_criterion_operation": {
                "create": {
                    "campaign": campaign,
                    "location": {"geo_target_constant": geo},
                }
            }
        },
        {
            "campaign_criterion_operation": {
                "create": {
                    "campaign": campaign,
                    "language": {"language_constant": "languageConstants/1000"},
                }
            }
        },
    ]
    for text in spec.get("negative_keywords", []):
        ops.append(
            {
                "campaign_criterion_operation": {
                    "create": {
                        "campaign": campaign,
                        "negative": True,
                        "keyword": {"text": text, "match_type": "PHRASE"},
                    }
                }
            }
        )
    for i, g in enumerate(spec["ad_groups"]):
        group = f"customers/{cid}/adGroups/{-100 - i}"
        ops.append(
            {
                "ad_group_operation": {
                    "create": {
                        "resource_name": group,
                        "name": g["id"],
                        "campaign": campaign,
                        "status": "PAUSED",
                        "type_": "SEARCH_STANDARD",
                        "cpc_bid_micros": spec["max_cpc_micros"],
                    }
                }
            }
        )
        for k in g["keywords"]:
            ops.append(
                {
                    "ad_group_criterion_operation": {
                        "create": {
                            "ad_group": group,
                            "status": "ENABLED",
                            "keyword": {"text": k["text"], "match_type": k["match"]},
                        }
                    }
                }
            )
        ops.append(
            {
                "ad_group_ad_operation": {
                    "create": {
                        "ad_group": group,
                        "status": "PAUSED",
                        "ad": {
                            "final_urls": [g["url"]],
                            "responsive_search_ad": {
                                "headlines": [{"text": s} for s in g["headlines"]],
                                "descriptions": [
                                    {"text": s} for s in g["descriptions"]
                                ],
                            },
                        },
                    }
                }
            }
        )
    return ops


def verify_paused(client, cid, spec, resource):
    """Read platform state, including every delivering parent, after any write."""
    found = rows(
        client,
        cid,
        f"SELECT campaign.status, campaign_budget.amount_micros, "
        "campaign.advertising_channel_type, campaign.bidding_strategy_type, "
        "campaign.geo_target_type_setting.positive_geo_target_type, "
        "campaign.network_settings.target_google_search, campaign.network_settings.target_search_network, "
        "campaign.network_settings.target_content_network, campaign.network_settings.target_partner_search_network "
        f"FROM campaign WHERE campaign.resource_name = '{resource}'",
    )
    if len(found) != 1:
        raise ValueError("Campaign readback missing or ambiguous")
    row = found[0]
    campaign = row.campaign
    network = campaign.network_settings
    if (
        campaign.status.name != "PAUSED"
        or campaign.advertising_channel_type.name != "SEARCH"
        or campaign.bidding_strategy_type.name != "MANUAL_CPC"
        or campaign.geo_target_type_setting.positive_geo_target_type.name != "PRESENCE"
        or not network.target_google_search
        or network.target_search_network
        or network.target_content_network
        or network.target_partner_search_network
        or row.campaign_budget.amount_micros != spec["daily_budget_micros"]
    ):
        raise ValueError("Live campaign settings differ from the paused proposal")
    groups = rows(
        client,
        cid,
        "SELECT ad_group.name, ad_group.status, ad_group.cpc_bid_micros "
        f"FROM ad_group WHERE campaign.resource_name = '{resource}' AND ad_group.status != REMOVED",
    )
    if sorted(g.ad_group.name for g in groups) != sorted(
        g["id"] for g in spec["ad_groups"]
    ) or any(
        g.ad_group.status.name != "PAUSED"
        or g.ad_group.cpc_bid_micros != spec["max_cpc_micros"]
        for g in groups
    ):
        raise ValueError("Live ad groups differ from the paused proposal")
    ads = rows(
        client,
        cid,
        "SELECT ad_group.name, ad_group_ad.status, ad_group_ad.ad.final_urls, "
        "ad_group_ad.ad.responsive_search_ad.headlines, ad_group_ad.ad.responsive_search_ad.descriptions "
        f"FROM ad_group_ad WHERE campaign.resource_name = '{resource}' AND ad_group_ad.status != REMOVED",
    )
    expected = {g["id"]: g for g in spec["ad_groups"]}
    seen = set()
    for row in ads:
        name = row.ad_group.name
        ad = row.ad_group_ad.ad
        g = expected.get(name)
        if (
            not g
            or name in seen
            or row.ad_group_ad.status.name != "PAUSED"
            or list(ad.final_urls) != [g["url"]]
            or sorted(x.text for x in ad.responsive_search_ad.headlines)
            != sorted(g["headlines"])
            or sorted(x.text for x in ad.responsive_search_ad.descriptions)
            != sorted(g["descriptions"])
        ):
            raise ValueError("Live ads differ from the paused proposal")
        seen.add(name)
    if seen != set(expected):
        raise ValueError("Expected ads missing from live readback")


def apply(client, cid, spec, *, validate_only=False):
    """Validate once, mutate once, verify; uncertain writes require a fresh read."""
    name = campaign_name(spec)
    existing = rows(
        client,
        cid,
        f"SELECT campaign.resource_name,campaign.name,campaign.status FROM campaign WHERE campaign.name = '{name}' AND campaign.status != REMOVED",
    )
    if existing:
        if len(existing) != 1 or existing[0].campaign.status.name != "PAUSED":
            raise ValueError(
                "Existing campaign is ambiguous or active; refusing mutation"
            )
        resource = existing[0].campaign.resource_name
        verify_paused(client, cid, spec, resource)
        return {
            "created": False,
            "campaign": resource,
            "status": "PAUSED",
            "fingerprint": fingerprint(spec),
        }
    siblings = rows(
        client,
        cid,
        f"SELECT campaign.id FROM campaign WHERE campaign.name LIKE 'AMP | AR | {spec['id']} | %' AND campaign.status != REMOVED",
    )
    if siblings:
        raise ValueError(
            "A different revision exists. Review and reconcile before creating another campaign."
        )
    geo = rows(
        client,
        cid,
        "SELECT geo_target_constant.resource_name FROM geo_target_constant WHERE geo_target_constant.name = 'Arkansas' AND geo_target_constant.country_code = 'US' AND geo_target_constant.target_type = 'State' AND geo_target_constant.status = ENABLED",
    )
    if len(geo) != 1:
        raise ValueError("Could not resolve the Arkansas state target uniquely")
    ops = build_operations(spec, cid, geo[0].geo_target_constant.resource_name)
    req = client.get_type("MutateGoogleAdsRequest")
    req.customer_id = cid
    req.partial_failure = False
    req.validate_only = True
    for op in ops:
        req.mutate_operations.append(type(client.get_type("MutateOperation"))(**op))
    service = client.get_service("GoogleAdsService")
    service.mutate(request=req)
    if validate_only:
        return {"validated": True, "created": False, "operations": len(ops)}
    req.validate_only = False
    service.mutate(request=req)
    found = rows(
        client,
        cid,
        f"SELECT campaign.resource_name,campaign.status FROM campaign WHERE campaign.name = '{name}' AND campaign.status != REMOVED",
    )
    if len(found) != 1 or found[0].campaign.status.name != "PAUSED":
        raise ValueError(
            "Post-apply verification failed; inspect account before any further action"
        )
    resource = found[0].campaign.resource_name
    verify_paused(client, cid, spec, resource)
    return {
        "created": True,
        "campaign": resource,
        "status": "PAUSED",
        "fingerprint": fingerprint(spec),
        "operations": len(ops),
    }


def export_script(spec, config, output):
    """Serialize the shared operation builder through the real API protobuf schema."""
    from google.ads.googleads.v26.services.types.google_ads_service import MutateOperation
    from google.protobuf.json_format import MessageToDict

    validate(spec)
    cid = config.get("customer_id", "")
    ceiling = config.get("max_daily_budget_micros")
    if not re.fullmatch(r"\d{10}", cid) or cid not in config.get("allowed_customer_ids", []):
        raise ValueError("Script customer must be a valid allowlisted advertiser")
    if type(ceiling) is not int or not 0 < spec["daily_budget_micros"] <= ceiling <= 2**53 - 1:
        raise ValueError("Script proposal exceeds its positive safe-integer budget ceiling")
    if spec["max_cpc_micros"] > 2**53 - 1:
        raise ValueError("Script bid exceeds JavaScript safe integer range")
    bundle = {
        "customerId": cid,
        "maxDailyBudgetMicros": ceiling,
        "fingerprint": fingerprint(spec),
        "name": campaign_name(spec),
        "spec": spec,
        "operations": [
            MessageToDict(MutateOperation.pb(MutateOperation(**op)))
            for op in build_operations(spec, cid, "geoTargetConstants/0")
        ],
    }
    source = Path(__file__).with_name("google-script.js").read_text()
    source += "\nconst AMP_MODE = \"inspect\";\nconst AMP_BUNDLE = " + json.dumps(bundle, ensure_ascii=True, indent=2) + ";\n"
    source += "function main() { return runAmpSearch(AdsApp, Logger, AMP_BUNDLE, AMP_MODE); }\n"
    # Generated bundles contain private account IDs, never credentials. Refuse overwrite.
    fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as file:
        file.write(source)
    return {"exported": True, "mode": "inspect", "platform_validated": False, "fingerprint": fingerprint(spec)}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "command", choices=["validate", "plan", "inspect", "apply-paused", "report", "export-script"]
    )
    p.add_argument("--spec")
    p.add_argument("--config")
    p.add_argument("--output")
    p.add_argument("--since")
    p.add_argument("--until")
    a = p.parse_args()
    if a.command == "report":
        try:
            report_dates(a.since, a.until)
        except ValueError as error:
            p.error(str(error))
    elif a.since or a.until:
        p.error("--since and --until are only valid for report")
    spec = validate(json.loads(Path(a.spec).read_text())) if a.spec else None
    if a.command in ["validate", "plan", "apply-paused", "export-script"] and spec is None:
        p.error("--spec required")
    if a.command == "validate":
        print(
            json.dumps(
                {
                    "valid": True,
                    "fingerprint": fingerprint(spec),
                    "name": campaign_name(spec),
                },
                indent=2,
            )
        )
        return
    if a.command == "plan" and not a.config:
        print(
            json.dumps(
                {
                    "mode": "offline proposal; live state not inspected",
                    "name": campaign_name(spec),
                    "status": "PAUSED",
                    "groups": len(spec["ad_groups"]),
                    "spec": spec,
                },
                indent=2,
            )
        )
        return
    if not a.config:
        p.error("--config required for platform access")
    config = json.loads(Path(a.config).read_text())
    if a.command == "export-script":
        if not a.output:
            p.error("--output required for a private script bundle")
        print(json.dumps(export_script(spec, config, a.output), indent=2))
        return
    client = client_from_config(config)
    cid = config["customer_id"]
    if a.command in ["inspect", "report"]:
        if a.command == "report":
            data = report(client, cid, a.since, a.until)
        else:
            found = rows(client, cid, "SELECT campaign.id,campaign.name,campaign.status FROM campaign WHERE campaign.status != REMOVED")
            data = [type(x).to_dict(x) for x in found]
        if a.output:
            Path(a.output).write_text(json.dumps(data, indent=2))
        else:
            print(json.dumps(data, indent=2))
        return
    ceiling = config.get("max_daily_budget_micros")
    if (
        type(ceiling) is not int
        or ceiling <= 0
        or spec["daily_budget_micros"] > ceiling
    ):
        raise ValueError(
            "Proposal exceeds the configured positive daily budget ceiling"
        )
    account = rows(client, cid, "SELECT customer.currency_code FROM customer")
    if len(account) != 1 or account[0].customer.currency_code != "USD":
        raise ValueError("This proposal requires a USD advertiser account")
    record = apply(client, cid, spec, validate_only=a.command == "plan")
    if a.output:
        Path(a.output).write_text(json.dumps(record, indent=2))
    print(json.dumps({k: v for k, v in record.items() if k != "campaign"}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # noqa: BLE001 -- sanitize third-party API errors at CLI boundary
        # SDK errors may include account identifiers and request data. Keep public logs minimal.
        print(
            f"Operation failed ({type(e).__name__}). No activation command was issued.",
            file=sys.stderr,
        )
        if isinstance(e, ValueError):
            print(str(e), file=sys.stderr)
        sys.exit(1)
