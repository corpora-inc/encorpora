# infra/scripts

## revenue_report.py — affiliate revenue & payout report

Per partner code, over any timeframe: conversions / renewals / refunds, gross +
net revenue, and the partner payout (**net × revenueSharePct**, where net = gross
less the platform fee, and refunds claw the payout back via negative reversal
rows), by currency. This is the routine report that drives partner payouts.

```bash
/home/skyl/tts_venv/bin/python corpan/infra/scripts/revenue_report.py            # last 28d
/home/skyl/tts_venv/bin/python corpan/infra/scripts/revenue_report.py --since 7d
/home/skyl/tts_venv/bin/python corpan/infra/scripts/revenue_report.py --from 2026-06-01 --to 2026-07-01
/home/skyl/tts_venv/bin/python corpan/infra/scripts/revenue_report.py --since 90d --json
```

Reads DynamoDB `corpan-iap` (loads admin creds from `~/.env`, else default AWS
chain). `$0` sandbox/test events are excluded by default (`--include-test` to show).

### Before paying anyone — three things to settle
1. **Basis: net (not gross).** The report pays `net × revShare`, where
   `net = gross × (1 − fee)` (default fee 0.15; `--fee` to override) less refunds.
   This is a share of NET developer proceeds after the store fee, so it is lower
   than a gross basis (e.g. SKY30 $24 gross, net ≈ $20.40 → $6.12 at 30%; the
   gross basis would have been $7.20). Confirm the agreed basis per partner.
2. **Currency / FX.** Amounts are per buyer currency. To pay in one currency,
   FX-convert or use the store payout reports.
3. **Accounting truth = store financial reports.** This ledger is the
   *attribution* source (which order → which partner). For exact settled amounts,
   join these orderIds against the Google earnings / Apple sales reports.

### What feeds the ledger
- Coded **initial** purchases → verify-purchase (in-app) or store notification.
- **Renewals / refunds** → RTDN (Google) + ASSN (Apple), now wired (Stage 3):
  renewals add `kind:renewal`, refunds add a negative `kind:reversal`.
- **Organic (no-code) revenue is NOT yet captured** (only coded events land in
  the ledger). Needed only for *total* revenue, not for partner payouts.
