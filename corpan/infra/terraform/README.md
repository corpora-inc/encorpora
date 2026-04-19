# Terraform — Corpan Infrastructure

## State Management

**State is local-only** — `terraform.tfstate` is gitignored and lives only on the machine that last ran `terraform apply`.

**Authoritative machine**: DGX Spark (`next-dgx` / this repo). Serial 56, last applied 2026-04-16.

If you're on a different machine and need to run terraform:
1. Do NOT run `terraform apply` without the current state — you'll create duplicate resources
2. Copy `terraform.tfstate` from the authoritative machine, or
3. (Better) Migrate to S3 remote backend (see TODO below)

If you find a stale `terraform.tfstate` on your machine, **delete it** rather than risk reading wrong values from it.

## Canonical Production URLs

These are the live, deployed values. Use these directly — don't rely on tfstate for URL lookups.

| Resource | Value |
|----------|-------|
| Verify API (Lambda) | `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod` |
| CDN (CloudFront) | `https://d38iwc9748jekz.cloudfront.net` |
| CloudFront Distribution ID | `E1RDNUCVE70SCI` |
| CloudFront Key Pair ID | `K2RX7CC6JLAZPW` |
| S3 Bucket | `corpan-prod` (us-east-2) |
| Secrets Manager | `corpan/content-packs/verify` (us-east-2) |
| AWS Profile | `corpan-publisher` |

> **WARNING**: A stale API Gateway `https://2rd7w09q7e...` existed from an earlier deployment. It returns "Internal Server Error" on all requests. Always use `dzxrs4szm7`.

## Reader Pack Build Env

Required at build time for premium content downloads:
```bash
VITE_GAME_VERIFY_URL=https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod
```

## TODO

- [ ] Migrate to S3 remote backend (`terraform { backend "s3" { ... } }`) so all machines share one state
- [ ] Add state locking via DynamoDB table

## Quick Reference

```bash
# Plan changes (read-only, safe)
terraform plan

# Apply changes (destructive — only from authoritative machine)
terraform apply

# Check what's deployed without tfstate
# See IAP_IMPLEMENTATION_STATE.md → Infrastructure Verification Commands
```
