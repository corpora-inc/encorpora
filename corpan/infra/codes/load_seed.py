#!/usr/bin/env python3
"""Load the affiliate/discount code registry seed into the corpan-iap DynamoDB
table (Phase 3 codes backend).

Reads ``seed.json`` (contract §8) and writes one item per partner and per code,
shaped to the contract §7.1 attribute spec:

  partners[]  ->  PK=PARTNER#<partnerId>  SK=META
  codes[]     ->  PK=CODE#<NORMALIZED>    SK=META

Idempotent: uses plain ``PutItem`` (re-running overwrites with the same data,
never double-credits anything — these are registry rows, not ledger rows).

Safe by default: prints what it WOULD write (dry-run) unless ``--yes`` is given.
Region us-east-2; table name from ``--table`` or ``$DYNAMO_TABLE`` (default
``corpan-iap``). Reuses standard AWS env credentials.

Usage:
    python load_seed.py                       # dry-run against corpan-iap
    python load_seed.py --yes                 # actually write
    python load_seed.py --table corpan-iap --yes
    python load_seed.py --seed ./seed.json --yes
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from decimal import Decimal
from pathlib import Path

REGION = "us-east-2"
DEFAULT_TABLE = "corpan-iap"

# Code normalization mirrors the client/server rule (contract §1).
_WS = re.compile(r"\s+")
_VALID = re.compile(r"^[A-Z0-9_-]{1,32}$")


def normalize_code(raw: str) -> str:
    code = _WS.sub("", raw.strip().upper())
    if not _VALID.match(code):
        raise ValueError(f"invalid code after normalization: {raw!r} -> {code!r}")
    return code


def _num(value) -> Decimal:
    # DynamoDB numbers must be Decimal; go through str to avoid float drift.
    return Decimal(str(value))


def partner_item(p: dict) -> dict:
    item = {
        "PK": f"PARTNER#{p['partnerId']}",
        "SK": "META",
        "name": p["name"],
        "defaultRevenueSharePct": _num(p.get("defaultRevenueSharePct", 0)),
        "status": p.get("status", "active"),
    }
    # payoutEmail is null-ok per §7.1 — only set it when present (DynamoDB has
    # no native null for a stored string we want to omit).
    if p.get("payoutEmail"):
        item["payoutEmail"] = p["payoutEmail"]
    return item


def code_item(c: dict) -> dict:
    code = normalize_code(c["code"])
    item = {
        "PK": f"CODE#{code}",
        "SK": "META",
        "partnerId": c["partnerId"],
        "classification": c["classification"],
        "googleBasePlanId": c.get("googleBasePlanId", ""),
        "discountLabelKey": c.get("discountLabelKey", ""),
        "discountLabelEn": c.get("discountLabelEn", ""),
        "revenueSharePct": _num(c.get("revenueSharePct", 0)),
        "active": bool(c.get("active", True)),
        "registryVersion": _num(c.get("registryVersion", 1)),
        "validFrom": c.get("validFrom", ""),
    }
    # null-ok string attributes — omit when null/absent.
    if c.get("appleOfferIdentifier"):
        item["appleOfferIdentifier"] = c["appleOfferIdentifier"]
    if c.get("googleOfferId"):
        item["googleOfferId"] = c["googleOfferId"]
    if c.get("validTo"):
        item["validTo"] = c["validTo"]
    # googleOfferTags is a String Set (SS) per §7.1; DynamoDB string sets
    # cannot be empty, so only set it when non-empty.
    tags = c.get("googleOfferTags") or []
    if tags:
        item["googleOfferTags"] = set(tags)
    return item


def build_items(seed: dict) -> list[dict]:
    items: list[dict] = []
    for p in seed.get("partners", []):
        items.append(partner_item(p))
    for c in seed.get("codes", []):
        items.append(code_item(c))
    return items


def _preview(item: dict) -> str:
    def _coerce(v):
        if isinstance(v, Decimal):
            return float(v)
        if isinstance(v, set):
            return sorted(v)
        return v

    return json.dumps({k: _coerce(v) for k, v in item.items()}, ensure_ascii=False)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--table",
        default=os.environ.get("DYNAMO_TABLE", DEFAULT_TABLE),
        help="DynamoDB table name (default $DYNAMO_TABLE or corpan-iap).",
    )
    parser.add_argument(
        "--seed",
        default=str(Path(__file__).with_name("seed.json")),
        help="Path to seed.json (default: alongside this script).",
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", REGION),
        help="AWS region (default us-east-2).",
    )
    parser.add_argument(
        "--yes",
        action="store_true",
        help="Actually write. Without this flag the script is a dry-run.",
    )
    args = parser.parse_args(argv)

    seed = json.loads(Path(args.seed).read_text(encoding="utf-8"))
    items = build_items(seed)

    print(
        f"Seed: {args.seed}\n"
        f"Table: {args.table} (region {args.region})\n"
        f"registryVersion: {seed.get('registryVersion')}\n"
        f"Items to write: {len(items)} "
        f"({len(seed.get('partners', []))} partners + {len(seed.get('codes', []))} codes)\n"
    )
    for item in items:
        print(f"  {item['PK']:<24} {item['SK']:<6} {_preview(item)}")

    if not args.yes:
        print("\nDry-run. Re-run with --yes to write these items.")
        return 0

    import boto3  # deferred so dry-runs work without boto3 installed

    table = boto3.resource("dynamodb", region_name=args.region).Table(args.table)
    written = 0
    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)
            written += 1
    print(f"\nWrote {written} items to {args.table}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
