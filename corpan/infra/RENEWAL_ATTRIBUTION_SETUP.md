# Renewal attribution — store/cloud setup

**Status:** the Lambda code is done and deployed. Renewal *crediting* (so an
affiliate keeps earning when a subscriber renews) needs the two stores to *send*
renewal notifications to our verify endpoint, and a few verification fields in the
`corpan/content-packs/verify` secret. First-purchase attribution already works
without any of this — renewals are an enhancement, safe to land just after release.

The verify API base is `verify_api_url`
(`https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod`). Routes already
live: `POST /apple-notifications`, `POST /google-notifications`.

What the Lambda does (already implemented, `lambda/verify_purchase.js`):
- **Apple**: verifies the ASSN V2 JWS, and on `DID_RENEW` / `SUBSCRIBED` looks up
  the affiliate by `appAccountToken` (== our `subjectId`) and writes a renewal
  credit to the ledger.
- **Google**: validates the Pub/Sub push **OIDC** token, and on
  `SUBSCRIPTION_RENEWED` (type 2) reverse-maps the buyer via `GSI1` (obfuscated
  account id) and writes a renewal credit.

---

## A. Apple — App Store Server Notifications V2

### A1. Secret fields to add (`secrets.apple`)
Currently present: `bundleId`, `issuer_id`, `key_id`, `privateKey`. Add:
- `appAppleId` — the app's numeric Apple ID (App Store Connect → App → App
  Information → "Apple ID"). Enables online checks in `SignedDataVerifier`.
- `notificationEnvironment` — `"Production"` (use `"Sandbox"` only for sandbox testing).
- `rootCerts` — JSON array of **base64 DER** Apple root CA certs (these are
  PUBLIC, not secret — just stored here for the verifier). Fetch the Apple Root
  CA - G3 cert from https://www.apple.com/certificateauthority/ and DER→base64 it.

Patch (read-modify-write, preserves other fields) — same pattern as the HMAC
inject in `STORE_AUTOMATION.md`:
```python
data["apple"]["appAppleId"] = "<numeric app id>"
data["apple"]["notificationEnvironment"] = "Production"
data["apple"]["rootCerts"] = ["<base64-DER AppleRootCA-G3>", ...]
```

### A2. Console step (one-time)
App Store Connect → App → **App Information → App Store Server Notifications** →
set **Production Server URL (Version 2)** to:
`https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/apple-notifications`
(and the Sandbox URL to the same while sandbox-testing). No ASC API for this — UI only.

### A3. Verify
Trigger a sandbox renewal (StoreKit sandbox auto-renews fast); watch the Lambda
logs for `[apple-notification] DID_RENEW` and a ledger `RENEWAL#` write.

---

## B. Google — Real-time developer notifications (RTDN) via Pub/Sub

RTDN delivers to a Cloud Pub/Sub topic; we use a **push** subscription with OIDC
auth to the verify endpoint. GCP project: `corpora1`.

### B1. Create the topic + push subscription (scriptable, `gcloud`)
```bash
PROJECT=corpora1
TOPIC=corpan-rtdn
PUSH_URL=https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/google-notifications
PUSH_SA=corpan-rtdn-push@corpora1.iam.gserviceaccount.com   # create or reuse

gcloud --project $PROJECT pubsub topics create $TOPIC

# Let Google Play publish to the topic (fixed Google-owned SA):
gcloud --project $PROJECT pubsub topics add-iam-policy-binding $TOPIC \
  --member="serviceAccount:google-play-developer-notifications@system.gserviceaccount.com" \
  --role="roles/pubsub.publisher"

# A dedicated SA to sign the push OIDC token:
gcloud --project $PROJECT iam service-accounts create corpan-rtdn-push \
  --display-name="Corpan RTDN push"

gcloud --project $PROJECT pubsub subscriptions create corpan-rtdn-push-sub \
  --topic=$TOPIC \
  --push-endpoint="$PUSH_URL" \
  --push-auth-service-account="$PUSH_SA" \
  --push-auth-token-audience="$PUSH_URL"
```

### B2. Secret fields to add (`secrets.google`)
So the Lambda validates the push OIDC token (`verifyPubSubOidc`):
```python
data["google"]["pubsubServiceAccount"] = "corpan-rtdn-push@corpora1.iam.gserviceaccount.com"
data["google"]["pubsubAudience"] = "https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/google-notifications"
```
(If both are omitted the Lambda skips OIDC validation — acceptable only for a
quick test, NOT production. Set them.)

### B3. Console step (one-time)
Play Console → **Monetization setup → Real-time developer notifications** → set
**Topic name** to `projects/corpora1/topics/corpan-rtdn` → Send test notification.
No Play API for this field — UI only.

### B4. Verify
"Send test notification" in Play Console should hit the endpoint (Lambda logs a
`[google-notification]`); a real sandbox renewal logs `SUBSCRIPTION_RENEWED` +
a ledger `RENEWAL#` write.

---

## Order of operations
1. Add the Apple + Google secret fields (B2, A1) — read-modify-write, preserves all
   existing keys (the `lifecycle ignore_changes` on the secret keeps Terraform off it).
2. Create the GCP topic + subscription (B1).
3. Set the two Console URLs/topics (A2, B3).
4. Trigger sandbox renewals and confirm ledger `RENEWAL#` writes (A3, B4).

Steps 1–2 are scriptable from this repo (AWS + gcloud creds); steps 3 are UI-only.
Nothing here changes first-purchase attribution, which is already live.
