# Phase 3 codes-backend — Terraform apply brief

Procedure for the infra/spark agent to apply the IAP **codes & discounts**
infrastructure on the canonical S3 state. Secret-free by design (repo is open
source). This adds the `/code/resolve` + `/entitlement-token` routes, the
`corpan-iap` DynamoDB table, and the codes Lambda — **nothing else should change.**

## Where
- Branch: **`app-store-prep`** (pull latest — it carries the terraform + lambda).
- Dir: `corpan/infra/terraform/`.
- State: wired in `backend.tf` → S3 `corpan-tf-state`, key
  `corpan-prod/terraform.tfstate`, region `us-east-2`. Just `terraform init`.
- AWS creds: the prod account that owns that state bucket.

## Prereqs (both matter)
1. **Your `terraform.tfvars` must be present.** A checkout *without* the prod
   tfvars plans to **destroy ~16 resources** (CloudFront, presence EC2, ECR,
   app_runner) because the feature-flag vars (`enable_cdn`,
   `enable_premium_content`, …) default off. Confirm the real tfvars are in
   place before planning. (This file is gitignored and lives only on the
   apply host — never commit it.)
2. **Vendor the Lambda deps:** `cd lambda && npm ci`. The Lambda zip is an
   `archive_file` over the whole `lambda/` dir, so `node_modules` must exist or
   the function deploys without its dependencies.

## Run
```bash
cd corpan/infra/terraform
terraform init
(cd lambda && npm ci)
terraform plan -out=phase3.plan
```

## STOP-and-confirm checklist (read the plan before applying)
The plan must be **create/update only**. Apply **only if**:

- ✅ Creates: `aws_dynamodb_table.corpan_iap` (+ its `GSI1`),
  `aws_apigatewayv2_route.code_resolve`, `aws_apigatewayv2_route.entitlement_token`,
  and updates `aws_lambda_function` (verify) for the new `DYNAMO_TABLE` env + IAM
  DynamoDB access.
- ✅ **No change** to `aws_secretsmanager_secret_version.verify` — it is protected
  by `lifecycle { ignore_changes = [secret_string] }`. The plan must NOT touch the
  secret value (the `codeSigning.hmacKey` is added out-of-band after apply).
- ❌ **ABORT** if the plan shows *any* **destroy/replace** of:
  `aws_cloudfront_distribution.packs`, the presence EC2 (`presence_ec2.tf`),
  `app_runner.tf` resources, ECR, the analytics CloudFront/S3, or the verify
  secret. Any of those means wrong/missing tfvars — do not apply; report what it
  wanted to destroy.

> Analytics resources in `analytics.tf` may appear as **creates** if not yet
> applied — that's fine and expected. The abort condition is *destroys*, not
> analytics creates.

```bash
terraform apply phase3.plan
```

## Report back
So the app/monetization owner can do the follow-up wiring (HMAC key into the
secret, `load_seed.py --yes`, the 8 Google offers, ASSN-V2/RTDN URLs):

```bash
terraform output iap_table_name   # expect: corpan-iap
terraform output verify_api_url
```
…and confirm the two new routes are live: `POST /code/resolve`,
`POST /entitlement-token`.

**Scope:** infra only. Don't touch app code, and don't write the secret value.
