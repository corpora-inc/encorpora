# In-App Purchase Setup Runbook

Step-by-step guide to get subscriptions and IAP products registered, reviewed,
and live on both Apple App Store and Google Play Store.

**Current state**: App v0.10.1, bundle ID `com.corpora.corpan`, IAP plugin code
integrated but no products registered on either store yet.

**Strategy**: Shadow launch — register subscription + one sample IAP product,
submit with a new app version (v0.11.0), get Apple approval. All current content
stays free. Paid content rolls out later.

---

## Prerequisites (before starting)

- [ ] Access to [App Store Connect](https://appstoreconnect.apple.com) with Admin role
- [ ] Access to [Google Play Console](https://play.google.com/console)
- [ ] Apple App Store Connect API key (.p8 file) — generate at Users & Access > Keys
- [ ] Google Cloud service account with `androidpublisher` API access
- [ ] App binary built with IAP plugin (the code changes from Phase 0A)

---

## Part 1: Apple App Store Connect

### 1.1 Create the Subscription Group

1. Go to **App Store Connect** > Your App (`com.corpora.corpan`) > **Subscriptions**
2. Click **Create Subscription Group**
3. Group name: `Corpan Premium`
   - Reference name (internal): `corpan_premium_access`
4. Save

### 1.2 Create Monthly Subscription

1. Inside the `Corpan Premium` group, click **Create Subscription**
2. Fill in:
   - Reference Name: `Premium Monthly`
   - Product ID: `corpan.sub.monthly`
3. Click **Create**
4. On the subscription detail page:

**Subscription Duration**: 1 Month

**Subscription Prices**:
1. Click **Add Subscription Price**
2. Starting Price: **$15.99 (USD)** — select the matching price point
3. Apple auto-calculates prices for all other territories
4. Save

**Localization** (at minimum, English US):
1. Click **Add Localization** (or edit existing)
2. Language: English (U.S.)
3. Subscription Display Name: `Corpan Premium`
4. Description: `Unlimited access to all narrated books. Listen to the world's stories.`
5. Save

**Review Information**:
1. Screenshot: Upload a screenshot of the app showing the subscription offer
   (can be a simulator screenshot of the SubscriptionOffer component)
2. Review Notes: `Auto-renewable subscription providing unlimited access to all
   premium narrated audiobook packs. Users can browse and download any premium
   content while subscription is active.`

### 1.3 Create Annual Subscription

1. Same group (`Corpan Premium`), click **Create Subscription**
2. Fill in:
   - Reference Name: `Premium Annual`
   - Product ID: `corpan.sub.annual`
3. Click **Create**
4. Subscription Duration: **1 Year**
5. Starting Price: **$99.99 (USD)** — Apple doesn't have $100.00 exactly; $99.99 is the standard tier
6. Localization:
   - Display Name: `Corpan Premium (Annual)`
   - Description: `Unlimited access to all narrated books. Save over 45% vs monthly.`
7. Screenshot + Review Notes: same as monthly

### 1.4 Set Subscription Group Display Order

1. In the subscription group, drag to set display order:
   - Annual (top — Apple recommends promoting best value first)
   - Monthly (bottom)

### 1.5 Create First Non-Consumable IAP Product

Even though no paid books exist yet, Apple requires the first IAP to be
submitted with an app version. Create a "placeholder" product for the first
book that WILL be premium (you can update the localization later).

1. Go to **In-App Purchases** section (separate from Subscriptions)
2. Click **Create In-App Purchase**
3. Type: **Non-Consumable**
4. Reference Name: `Sample Premium Narration`
5. Product ID: `corpan.narration.sample_premium`
   (use a generic ID — or use the real first premium book ID if you know it)
6. Click **Create**
7. Price: **$4.99 (USD)** — select matching price point
8. Localization:
   - Display Name: `Premium Narration Pack`
   - Description: `A complete narrated audiobook pack with word-level synchronized text.`
9. Screenshot: Same app screenshot showing the purchase flow
10. Review Notes: `Non-consumable in-app purchase that unlocks a single narrated
    audiobook pack for permanent offline access.`

### 1.6 Build and Submit App Version v0.11.0

**On the DGX Spark (or Mac build machine):**

```bash
# 1. Bump version
# Edit src-tauri/tauri.conf.json: change version to "0.11.0"
# Edit src-tauri/ios/project.yml: bump CFBundleShortVersionString and CFBundleVersion

# 2. Build iOS binary
cd ~/encorpora/corpan/corpan-app
npm run build
npm run tauri ios build

# 3. The IPA will be at src-tauri/gen/apple/build/corpan_iOS.ipa
```

**NOTE**: iOS builds require a Mac with Xcode. If the DGX Spark is Linux/ARM,
you'll need to build on a Mac.

**In App Store Connect:**

1. Upload the IPA using **Transporter** app (macOS) or `xcrun altool`
2. Go to your app > **App Store** tab > click the new version `0.11.0`
3. In the **In-App Purchases and Subscriptions** section of the version page:
   - Click **Select In-App Purchases** → check `corpan.narration.sample_premium`
   - Click **Select Subscriptions** → check both `corpan.sub.monthly` and `corpan.sub.annual`
4. Fill in the version's **What's New** text:
   `Introducing premium content and subscriptions. Browse and purchase individual
   narrated books, or subscribe for unlimited access to the entire library.`
5. Add any required screenshots for the new version
6. Click **Submit for Review**

Apple will review the app version + IAP + subscriptions together. Expect 24-48 hours.

### 1.7 After Apple Approval

Once approved:
- Subscriptions and the sample IAP are live (but no premium content in catalog yet)
- The app shows subscription UI but there's nothing to buy yet — that's fine
- Future IAP products can be submitted independently (no new app version needed)
- Future IAPs: create via API or console → submit for review → approved independently

---

## Part 2: Google Play Console

Google is simpler — no review required for IAP products.

### 2.1 Create Subscription Products

1. Go to **Google Play Console** > Your App > **Monetize** > **Subscriptions**
2. Click **Create subscription**

**Monthly:**
- Product ID: `corpan.sub.monthly`
- Name: `Corpan Premium`
- Description: `Unlimited access to all narrated books.`
- Click **Create**
- Add a **Base Plan**:
  - Base plan ID: `monthly-autorenew`
  - Billing period: **1 month**
  - Renewal type: **Auto-renewing**
  - Price: Click **Set prices** → $15.99 USD → **Update** (auto-converts other regions)
  - Grace period: 3 days
- Click **Activate** on the base plan
- Click **Activate** on the subscription

**Annual:**
- Product ID: `corpan.sub.annual`
- Name: `Corpan Premium (Annual)`
- Description: `Unlimited access to all narrated books. Save over 45%.`
- Base plan ID: `annual-autorenew`
- Billing period: **1 year**
- Price: $99.99 USD
- Activate base plan → Activate subscription

### 2.2 Create First In-App Product

1. Go to **Monetize** > **In-app products**
2. Click **Create product**
3. Product ID: `corpan.narration.sample_premium`
4. Name: `Premium Narration Pack`
5. Description: `A complete narrated audiobook pack.`
6. Default price: $4.99 USD
7. Status: **Active**
8. Click **Save** → **Activate**

Product is **immediately available** for purchase. No review.

### 2.3 Set Up License Testing

1. Go to **Settings** > **License testing**
2. Add your Google account email(s) as license testers
3. License response: **RESPOND_NORMALLY** (or use LICENSED for free testing)

### 2.4 Upload New App Version

```bash
# Build Android AAB
cd ~/encorpora/corpan/corpan-app
npm run build
npm run tauri android build

# AAB at: src-tauri/gen/android/app/build/outputs/bundle/release/app-release.aab
```

1. Go to **Production** (or **Internal testing** first)
2. Click **Create new release**
3. Upload the AAB
4. Release name: `0.11.0`
5. Release notes: `Premium content support: subscriptions and individual book purchases.`
6. Review and roll out

### 2.5 Set Up Real-Time Developer Notifications (RTDN)

1. Go to **Monetize** > **Monetization setup**
2. Under **Real-time developer notifications**:
3. Topic name: Create a Google Cloud Pub/Sub topic (e.g., `corpan-play-billing-events`)
4. Or use the direct push URL: `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/google-notifications`
   (This is the Lambda webhook endpoint we created)
5. Save

---

## Part 3: Apple Server Notifications Setup

1. Go to **App Store Connect** > Your App > **App Information**
2. Scroll to **App Store Server Notifications**
3. Production URL: `https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/apple-notifications`
4. Sandbox URL: (same URL, or a separate staging endpoint)
5. Notification version: **Version 2**
6. Save

---

## Part 4: Populate AWS Secrets

After getting API credentials from both platforms:

```bash
# Using boto3 from the tts_venv (no AWS CLI on this machine)
/home/skyl/tts_venv/bin/python << 'PYEOF'
import json
import boto3
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path.home() / ".env")

sm = boto3.client("secretsmanager", region_name="us-east-2")

# Read your credential files
apple_p8 = open("/path/to/AuthKey_XXXXXXXX.p8").read()
google_sa = open("/path/to/service-account.json").read()
cf_signing_key = open("/path/to/cloudfront-private-key.pem").read()

secret = {
    "apple": {
        "key_id": "YOUR_APPLE_KEY_ID",        # from App Store Connect > Keys
        "issuer_id": "YOUR_APPLE_ISSUER_ID",   # from App Store Connect > Keys
        "privateKey": apple_p8,
        "bundleId": "com.corpora.corpan"
    },
    "google": {
        "packageName": "com.corpora.corpan",
        "serviceAccountJson": google_sa
    },
    "cloudfront": {
        "signingPrivateKey": cf_signing_key
    }
}

sm.update_secret(
    SecretId="corpan/content-packs/verify",
    SecretString=json.dumps(secret)
)
print("Secrets updated successfully")
PYEOF
```

---

## Part 5: Generate CloudFront Signing Key Pair

```bash
# Generate RSA key pair for CloudFront signed URLs
openssl genrsa -out /tmp/cf-signing-private.pem 2048
openssl rsa -in /tmp/cf-signing-private.pem -pubout -out /tmp/cf-signing-public.pem

# The public key goes into Terraform (cloudfront_signing_public_key_pem variable)
# The private key goes into Secrets Manager (cloudfront.signingPrivateKey)

cat /tmp/cf-signing-public.pem
# Copy this into terraform.tfvars:
# cloudfront_signing_public_key_pem = "-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

Then:
```bash
cd ~/encorpora/corpan/infra/terraform
~/bin/terraform plan -var="enable_cdn=true" -var="enable_premium_content=true"
~/bin/terraform apply -var="enable_cdn=true" -var="enable_premium_content=true"
```

---

## Part 6: Testing

### Apple Sandbox Testing
1. Create a **Sandbox Apple ID** in App Store Connect > Users & Access > Sandbox Testers
2. On your test device: Settings > App Store > Sandbox Account → sign in with sandbox ID
3. Open the app → try purchasing a subscription → should use sandbox (no real charge)
4. Sandbox subscriptions auto-renew on accelerated schedule:
   - 1 month → renews every 5 minutes
   - 1 year → renews every 1 hour

### Google Play Testing
1. Add your email to **License testing** (Settings > License testing)
2. Publish to **Internal testing** track first
3. Open the app from Play Store internal link → purchase → test card (no real charge)

### Verify Lambda
```bash
# Test with dev bypass
curl -X POST https://dzxrs4szm7.execute-api.us-east-2.amazonaws.com/prod/verify-purchase \
  -H "content-type: application/json" \
  -H "x-dev-bypass: YOUR_DEV_BYPASS_TOKEN" \
  -d '{"platform":"ios","productId":"corpan.sub.monthly","packId":"test"}'
```

---

## Checklist Summary

### Apple (must be done in order)
- [ ] Create subscription group `Corpan Premium`
- [ ] Create `corpan.sub.monthly` ($15.99)
- [ ] Create `corpan.sub.annual` ($99.99)
- [ ] Create `corpan.narration.sample_premium` ($4.99) non-consumable
- [ ] Add localizations for all products
- [ ] Upload review screenshots for all products
- [ ] Set up App Store Server Notifications V2 webhook
- [ ] Build app v0.11.0 with IAP plugin
- [ ] Upload IPA to App Store Connect
- [ ] Attach subscriptions + IAP to the version
- [ ] Submit for review
- [ ] Wait for approval (24-48h)

### Google (order doesn't matter much)
- [ ] Create `corpan.sub.monthly` subscription + activate
- [ ] Create `corpan.sub.annual` subscription + activate
- [ ] Create `corpan.narration.sample_premium` product + activate
- [ ] Set up RTDN webhook
- [ ] Add license test accounts
- [ ] Build AAB and upload to Play Console
- [ ] Publish to internal testing track

### Infrastructure
- [ ] Generate CloudFront signing key pair
- [ ] Run `terraform apply` with premium content enabled
- [ ] Populate Secrets Manager with Apple/Google/CloudFront credentials
- [ ] Test Lambda with dev bypass token
- [ ] Test end-to-end with sandbox accounts

### After Approval (ready for paid content)
- [ ] Publish first premium narration pack via `ttsctl publish --tier premium`
- [ ] Register corresponding IAP product (Apple: submit for review; Google: create via API)
- [ ] Verify purchase flow end-to-end on both platforms
