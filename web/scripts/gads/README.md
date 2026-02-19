# Google Ads CLI

CLI tool for managing Google Ads conversions without the web UI.

## One-Time Setup

### 1. Developer Token

Go to [ads.google.com/aw/apicenter](https://ads.google.com/aw/apicenter) and apply for a developer token. Test access is approved instantly.

### 2. OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a project (or use existing)
3. Enable the **Google Ads API**
4. Create **OAuth 2.0 Client ID** (Desktop app type)
5. Note the `client_id` and `client_secret`

### 3. Refresh Token

```bash
pip install google-ads
python -c "from google.ads.googleads.client import GoogleAdsClient; GoogleAdsClient.generate_refresh_token()"
```

Follow the prompts — you'll get a `refresh_token`.

### 4. Config File

```bash
cp google-ads.yaml.example google-ads.yaml
```

Fill in all fields. This file is gitignored.

## Install

```bash
pip install -r requirements.txt
```

## Usage

```bash
# List conversion actions
python cli.py list-conversions --customer-id 1234567890

# Create a page-view conversion
python cli.py create-conversion \
  --customer-id 1234567890 \
  --name "Encorpora Page View" \
  --category PAGE_VIEW \
  --type WEBPAGE

# Get tag snippets
python cli.py get-tag-snippets \
  --customer-id 1234567890 \
  --conversion-action-id 987654321

# Check tracking status
python cli.py check-status --customer-id 1234567890

# Upload offline conversion
python cli.py upload-conversion \
  --customer-id 1234567890 \
  --conversion-action-id 987654321 \
  --gclid "test-click-id" \
  --conversion-time "2026-02-18 12:00:00-05:00" \
  --value 1.0
```

## What Requires the UI

- Initial developer token application (one-time)
- OAuth2 consent screen setup (one-time)
- Tag Assistant verification (browser-based)
- Accepting ToS (one-time)
