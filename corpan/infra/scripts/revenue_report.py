#!/usr/bin/env python3
"""
Affiliate revenue & payout report over the corpan-iap ledger.

Per partner code, over any timeframe: conversions / renewals / refunds, gross +
NET revenue, and the partner PAYOUT (net x rev-share, net of refunds), by
currency. This is the routine, on-demand report that drives partner payouts.

Usage:
  revenue_report.py                       # last 28 days
  revenue_report.py --since 7d
  revenue_report.py --since 90d --json
  revenue_report.py --from 2026-06-01 --to 2026-07-01
  revenue_report.py --rate 0.20           # what-if: pay everyone 20% of net
  revenue_report.py --fee 0.30            # store fee 30% (default 0.15)
  revenue_report.py --include-test        # include $0 sandbox/test events

Auth: needs DynamoDB read on corpan-iap. Loads admin creds from ~/.env
(AWS_ACCESS_KEY/AWS_SECRET_ACCESS_KEY) if present, else the default AWS chain.

BASIS:
  * net   = exact developer proceeds if stored on the event (`developerRevenue`),
            else gross x (1 - --fee). Default fee 0.15 (matches observed Play
            proceeds: $24 gross -> $20.40 net). Override with --fee.
  * payout = net x rev-share. Rev-share is per-partner (registry
            `revenueSharePct`, snapshotted on each event); --rate overrides it
            for what-if modeling.

CAVEATS (read before paying anyone):
  * Amounts are in each buyer's CURRENCY (no FX). Totals are per-currency.
  * Only CODED conversions are in this ledger, so totals here are the
    code-attributed portion — NOT company-wide revenue. Organic/no-code revenue
    is not captured yet. Accounting-grade settled amounts live in the
    Google/Apple financial reports (join these orderIds for exactness).
"""
import argparse, json, os, datetime
from collections import defaultdict
from decimal import Decimal

TABLE = "corpan-iap"


def load_env_creds():
    p = os.path.expanduser("~/.env")
    if not os.path.exists(p):
        return
    env = {}
    for line in open(p):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    ak = env.get("AWS_ACCESS_KEY") or env.get("AWS_ACCESS_KEY_ID")
    sk = env.get("AWS_SECRET_ACCESS_KEY")
    if ak and sk:
        os.environ.setdefault("AWS_ACCESS_KEY_ID", ak)
        os.environ.setdefault("AWS_SECRET_ACCESS_KEY", sk)
    os.environ.setdefault("AWS_DEFAULT_REGION", env.get("AWS_DEFAULT_REGION", "us-east-2"))


def parse_window(since, frm, to):
    now = datetime.datetime.now(datetime.timezone.utc)
    if frm:
        start = datetime.datetime.fromisoformat(frm).replace(tzinfo=datetime.timezone.utc)
        end = datetime.datetime.fromisoformat(to).replace(tzinfo=datetime.timezone.utc) if to else now
    else:
        s = since or "28d"
        n = int(s[:-1]) if s.endswith("d") else int(s)
        start, end = now - datetime.timedelta(days=n), now
    return start, end


def main():
    ap = argparse.ArgumentParser(description="Affiliate revenue & payout report")
    ap.add_argument("--since", help="e.g. 7d, 28d, 90d (default 28d)")
    ap.add_argument("--from", dest="frm", help="YYYY-MM-DD (UTC)")
    ap.add_argument("--to", help="YYYY-MM-DD (UTC); default now")
    ap.add_argument("--fee", type=float, default=0.15, help="store fee fraction for net estimate (default 0.15)")
    ap.add_argument("--rate", type=float, help="override rev-share for ALL partners (what-if), e.g. 0.20")
    ap.add_argument("--include-test", action="store_true", help="include $0 sandbox/test events")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    load_env_creds()
    import boto3
    start, end = parse_window(a.since, a.frm, a.to)
    fee = Decimal(str(a.fee))

    tbl = boto3.resource("dynamodb").Table(TABLE)
    items, kw = [], {}
    while True:
        r = tbl.scan(**kw)
        items += r.get("Items", [])
        if "LastEvaluatedKey" not in r:
            break
        kw["ExclusiveStartKey"] = r["LastEvaluatedKey"]

    # Defensive: a reversal row written before reverseCredit snapshotted the
    # original rev-share carries no revenueSharePct → its payout clawback would
    # be 0 and partners stay overpaid. Resolve a missing pct from the matching
    # original credit row (same partner + EVENT#<platform>#<txn>, sans the
    # `#reversal` suffix). The row-write fix is primary; this rescues legacy rows.
    pct_by_credit = {}
    for it in items:
        pk, sk = str(it.get("PK", "")), str(it.get("SK", ""))
        if not pk.startswith("LEDGER#") or not sk.startswith("EVENT#"):
            continue
        if sk.endswith("#reversal") or it.get("revenueSharePct") is None:
            continue
        partner = pk.split("#")[1]
        pct_by_credit[(partner, sk)] = it.get("revenueSharePct")

    agg = defaultdict(lambda: defaultdict(lambda: {"gross": Decimal(0), "net": Decimal(0),
          "payout": Decimal(0), "initial": 0, "renewal": 0, "reversal": 0}))
    skipped = 0
    for it in items:
        pk, sk = str(it.get("PK", "")), str(it.get("SK", ""))
        if not pk.startswith("LEDGER#") or not sk.startswith("EVENT#") or not it.get("eventTime"):
            continue
        ts = datetime.datetime.fromisoformat(it["eventTime"].replace("Z", "+00:00"))
        if not (start <= ts < end):
            continue
        partner = pk.split("#")[1]
        partner = "(organic/no-code)" if partner == "__house__" else partner
        gross = Decimal(str(it.get("price") or 0))
        if gross == 0 and not a.include_test:
            skipped += 1
            continue
        # exact net if present (e.g. Google developerRevenue), else estimate
        net = Decimal(str(it["developerRevenue"])) if it.get("developerRevenue") is not None else gross * (1 - fee)
        # Per-row rev-share, snapshotted on each event; for a reversal missing it,
        # fall back to the matching original credit's pct (see pct_by_credit).
        row_pct = it.get("revenueSharePct")
        if row_pct is None and sk.endswith("#reversal"):
            credit_partner = pk.split("#")[1]
            row_pct = pct_by_credit.get((credit_partner, sk[: -len("#reversal")]))
        rate = Decimal(str(a.rate)) if a.rate is not None else Decimal(str(row_pct or 0))
        cur = it.get("currency") or "?"
        kind = it.get("kind") or "initial"
        b = agg[partner][cur]
        b["gross"] += gross
        b["net"] += net
        b["payout"] += net * rate
        b[kind] = b.get(kind, 0) + 1

    win = {"from": start.isoformat(), "to": end.isoformat()}
    if a.json:
        print(json.dumps({"window": win, "fee": a.fee, "rate_override": a.rate,
              "skipped_test_events": skipped, "partners": {p: {c: {k: (float(v) if isinstance(v, Decimal) else v)
              for k, v in d.items()} for c, d in cur.items()} for p, cur in agg.items()}}, indent=2))
        return

    rate_lbl = f"rate={a.rate}" if a.rate is not None else "rate=per-partner"
    print(f"Affiliate revenue & payout — {start.date()} .. {end.date()} (UTC)   net=gross×(1-{a.fee})  {rate_lbl}")
    if skipped:
        print(f"(excluded {skipped} $0 sandbox/test events; --include-test to show)")
    print(f"{'CODE/partner':22} {'cur':4} {'conv':>5} {'renew':>6} {'refnd':>6} {'gross':>11} {'net':>11} {'PAYOUT':>11}")
    print("-" * 84)
    tg, tn, tp = defaultdict(Decimal), defaultdict(Decimal), defaultdict(Decimal)
    for partner in sorted(agg):
        for cur, d in sorted(agg[partner].items()):
            print(f"{partner:22} {cur:4} {d['initial']:>5} {d['renewal']:>6} {d['reversal']:>6} "
                  f"{d['gross']:>11.2f} {d['net']:>11.2f} {d['payout']:>11.2f}")
            tg[cur] += d["gross"]; tn[cur] += d["net"]; tp[cur] += d["payout"]
    print("-" * 84)
    for cur in sorted(tp):
        print(f"{'TOTAL (coded)':22} {cur:4} {'':>5} {'':>6} {'':>6} {tg[cur]:>11.2f} {tn[cur]:>11.2f} {tp[cur]:>11.2f}")
    if not agg:
        print("(no revenue events in window)")


if __name__ == "__main__":
    main()
