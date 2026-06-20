#!/usr/bin/env python3
"""
Affiliate revenue & payout report over the corpan-iap ledger.

Per partner code, over any timeframe: conversions / renewals / refunds, gross
revenue, and the partner PAYOUT (gross x revenueSharePct, net of refunds),
broken out by currency. This is the routine report that drives partner payouts.

Usage:
  revenue_report.py                      # last 28 days
  revenue_report.py --since 7d
  revenue_report.py --since 90d --json
  revenue_report.py --from 2026-06-01 --to 2026-07-01
  revenue_report.py --include-test       # include $0 sandbox/test events

Auth: needs DynamoDB read on corpan-iap. Loads admin creds from ~/.env
(AWS_ACCESS_KEY/AWS_SECRET_ACCESS_KEY) if present, else the default AWS chain.

CAVEATS (read before paying anyone):
  * Amounts are in each buyer's CURRENCY (no FX). Totals are per-currency; to pay
    in one currency, FX-convert or reconcile against store payout reports.
  * `gross` = customer-paid price. Whether the partner's % applies to gross or to
    NET developer proceeds (after the ~15-30% store fee + taxes/refunds) is a
    business decision — see PAYOUT_BASIS below. Default shows gross-basis payout.
  * Authoritative settled amounts live in the Google/Apple financial reports;
    this ledger is the ATTRIBUTION source (which transaction -> which partner).
    For exact payouts, join these orderIds against those reports.
"""
import argparse, json, os, sys, datetime
from collections import defaultdict
from decimal import Decimal

TABLE = "corpan-iap"
PAYOUT_BASIS = "gross"  # informational; report computes gross x revShare


def load_env_creds():
    p = os.path.expanduser("~/.env")
    if not os.path.exists(p):
        return
    env = {}
    for line in open(p):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    ak = env.get("AWS_ACCESS_KEY") or env.get("AWS_ACCESS_KEY_ID")
    sk = env.get("AWS_SECRET_ACCESS_KEY")
    if ak and sk:
        os.environ.setdefault("AWS_ACCESS_KEY_ID", ak)
        os.environ.setdefault("AWS_SECRET_ACCESS_KEY", sk)
    os.environ.setdefault("AWS_DEFAULT_REGION", env.get("AWS_DEFAULT_REGION", "us-east-2"))


def parse_window(args):
    now = datetime.datetime.now(datetime.timezone.utc)
    if args.get("from"):
        start = datetime.datetime.fromisoformat(args["from"]).replace(tzinfo=datetime.timezone.utc)
        end = (datetime.datetime.fromisoformat(args["to"]).replace(tzinfo=datetime.timezone.utc)
               if args.get("to") else now)
    else:
        s = args.get("since") or "28d"
        n = int(s[:-1]) if s[-1] == "d" else int(s)
        start, end = now - datetime.timedelta(days=n), now
    return start, end


def main():
    ap = argparse.ArgumentParser(description="Affiliate revenue & payout report")
    ap.add_argument("--since", help="e.g. 7d, 28d, 90d (default 28d)")
    ap.add_argument("--from", dest="from_", help="YYYY-MM-DD (UTC)")
    ap.add_argument("--to", help="YYYY-MM-DD (UTC); default now")
    ap.add_argument("--include-test", action="store_true", help="include $0 sandbox/test events")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    load_env_creds()
    import boto3
    start, end = parse_window({"since": a.since, "from": a.from_, "to": a.to})

    tbl = boto3.resource("dynamodb").Table(TABLE)
    items, kw = [], {}
    while True:
        r = tbl.scan(**kw)
        items += r.get("Items", [])
        if "LastEvaluatedKey" not in r:
            break
        kw["ExclusiveStartKey"] = r["LastEvaluatedKey"]

    # partner -> currency -> aggregates
    agg = defaultdict(lambda: defaultdict(lambda: {"gross": Decimal(0), "payout": Decimal(0),
                                                   "initial": 0, "renewal": 0, "reversal": 0}))
    skipped_test = 0
    for it in items:
        pk = str(it.get("PK", ""))
        if not pk.startswith("LEDGER#") or not str(it.get("SK", "")).startswith("EVENT#"):
            continue
        et = it.get("eventTime")
        if not et:
            continue
        ts = datetime.datetime.fromisoformat(et.replace("Z", "+00:00"))
        if not (start <= ts < end):
            continue
        partner = pk.split("#")[1]
        if partner == "__house__":
            partner = "(organic/no-code)"
        price = Decimal(str(it.get("price") or 0))
        if price == 0 and not a.include_test:
            skipped_test += 1
            continue
        cur = it.get("currency") or "?"
        rs = Decimal(str(it.get("revenueSharePct") or 0))
        kind = it.get("kind") or "initial"
        b = agg[partner][cur]
        b["gross"] += price
        b["payout"] += price * rs
        b[kind] = b.get(kind, 0) + 1

    window = {"from": start.isoformat(), "to": end.isoformat()}
    if a.json:
        out = {"window": window, "skipped_test_events": skipped_test, "partners": {
            p: {c: {k: (float(v) if isinstance(v, Decimal) else v) for k, v in d.items()}
                for c, d in cur.items()} for p, cur in agg.items()}}
        print(json.dumps(out, indent=2))
        return

    print(f"Affiliate revenue & payout — {start.date()} .. {end.date()} (UTC)   basis={PAYOUT_BASIS}")
    if skipped_test:
        print(f"(excluded {skipped_test} $0 sandbox/test events; --include-test to show)")
    print(f"{'CODE/partner':22} {'cur':4} {'conv':>5} {'renew':>6} {'refund':>7} {'gross':>12} {'PAYOUT':>12}")
    print("-" * 74)
    tot_payout = defaultdict(Decimal)
    tot_gross = defaultdict(Decimal)
    for partner in sorted(agg):
        for cur, d in sorted(agg[partner].items()):
            print(f"{partner:22} {cur:4} {d['initial']:>5} {d['renewal']:>6} {d['reversal']:>7} "
                  f"{d['gross']:>12.2f} {d['payout']:>12.2f}")
            tot_payout[cur] += d["payout"]
            tot_gross[cur] += d["gross"]
    print("-" * 74)
    for cur in sorted(tot_payout):
        print(f"{'TOTAL':22} {cur:4} {'':>5} {'':>6} {'':>7} {tot_gross[cur]:>12.2f} {tot_payout[cur]:>12.2f}")
    if not agg:
        print("(no revenue events in window)")


if __name__ == "__main__":
    main()
