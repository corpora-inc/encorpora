# ClassWallet payment reconciliation

AMP matches an authenticated vendor payment report to the UUID printed on an AMP invoice. A settled, fully matched payment provisions the quoted learner through the commerce ledger. Parent names and email addresses are not matching keys.

Run from `amp/`:

```sh
npx tsx scripts/classwallet-import.ts --dry-run /private/report.csv /private/classwallet-config.json
npx tsx scripts/classwallet-import.ts --apply /private/report.csv /private/classwallet-config.json
```

Both commands require `AMP_DATABASE_URL` and `AMP_FUNDING_OFFERS_FILE`. Use a report downloaded from the authenticated vendor portal. Never accept a parent-uploaded CSV or an email attachment as payment authority. Keep reports and mappings outside public repositories.

The strict config schema is `classWalletConfigSchema` in `src/funding-purchase/classwallet.ts`. It requires a private verification reference, exact organization/state/distribution mappings to approved offers, and independently verified gross/net column meanings. Gross must equal net plus fee and match the invoice. The parser accepts unsigned decimal dollar amounts with two decimal places and canonical UTC ISO timestamps only. Unknown formats are quarantined; do not guess the timezone or modify evidence to bypass validation. Verify actual populated report formats and settlement timestamp semantics before configuring production. An empty report verifies headers, not those semantics.

Dry run checks report-to-invoice matching. It does not lock records or guarantee consent, offer availability or entitlement at application time. Apply rechecks those conditions inside the existing provisioning transaction. Repeated successful imports preserve the original activation date and exact ledger events. A provider transaction has one global order identifier, preventing reuse for another learner. Duplicate transactions within one file are all quarantined before row processing. Conflicting amounts, partial payments, refunds and unsupported statuses require review and never grant access.

Output contains row numbers, outcomes and reason codes, without family details. Exit code 2 means one or more rows need review; successful rows may already be committed. Retain the source report securely with the outcome log. Rerunning is safe. Correct a source or mapping problem before retrying; do not hand-edit a settled payment into existence.

This command automates reconciliation and provisioning after a verified report is supplied. It does not fetch reports or establish a ClassWallet webhook. Unattended acquisition requires a documented provider-supported interface. An authenticated staff import is the supported fallback until that interface is verified.
