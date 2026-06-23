# IAP store notifications (RTDN / ASSN) — wiring & runbook

Server-side handling of subscription lifecycle events (renewal, cancel, grace,
on-hold, refund/revoke) lives in the verify lambda:
`POST /google-notifications` (Google RTDN) and `POST /apple-notifications`
(Apple ASSN V2), at `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod`.
The handlers dedupe, re-fetch authoritative state, extend entitlement, credit
partner renewals, and claw back on refund/revoke.

## Google RTDN — WIRED & VERIFIED ✅

Terraform (`rtdn.tf`) created, on the existing topic `projects/corpora1/topics/play-billing-notifications`:
- an **authenticated push subscription** → `…/prod/google-notifications`,
- a push OIDC identity `rtdn-push-invoker@corpora1.iam.gserviceaccount.com`,
- `roles/iam.serviceAccountTokenCreator` for the Pub/Sub service agent.

The secret `corpan/content-packs/verify` has `google.pubsubAudience` +
`google.pubsubServiceAccount`, so the handler verifies the push OIDC token
(fail-closed). Validated end-to-end on 2026-06-19: a published test message was
delivered, OIDC-verified, and processed (`test notification OK`).

**You should still confirm (one-time, UI):** Play Console → Monetization setup →
Real-time developer notifications → Topic = `projects/corpora1/topics/play-billing-notifications`
(the topic already grants Google Play publisher, so this is likely already set) →
click **Send test notification** and confirm a `[google-notification]` line in
CloudWatch `/aws/lambda/corpan-verify-purchase`.

## Apple ASSN V2 — HANDLER READY, needs the URL set ⚠️

The handler verifies the JWS against the Apple root CAs (G2+G3, in the secret),
tries both Production & Sandbox, and requires `apple.appAppleId` (6746082061) —
all now configured. There is **no ASC API to set the notification URL**, so:

**You must do (one-time, ASC UI):** App Store Connect → app **Corpán** → App
Information → **App Store Server Notifications** → set **Production Server URL**
*and* **Sandbox Server URL** to:
`https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/apple-notifications`
(Version 2). Then use Apple's "request a test notification" if available and
confirm an `[apple-notification]` line in CloudWatch.

## Alerts

`observability.tf` adds a CloudWatch alarm on verify/notification error log
markers → SNS topic `corpan-iap-alerts` → email `skylar.saveland@gmail.com`.
**Confirm the SNS subscription** via the email Amazon sent after `terraform apply`.

## Re-apply

```
cd corpan/infra/terraform
export $(grep -v '^#' ~/.env | xargs)   # AWS admin
export AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY" AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY"
export GOOGLE_APPLICATION_CREDENTIALS=/home/skyl/secrets/gcp.json GOOGLE_CLOUD_PROJECT=corpora1
terraform apply
```
Secret values (`apple.rootCerts`, `apple.appAppleId`, `google.pubsub*`) are NOT
in Terraform (the secret is `ignore_changes`); they were merged via the AWS CLI.
