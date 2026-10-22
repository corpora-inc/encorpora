# AMP advertising workbench

Create reviewable AMP images and videos from real product captures, and validate or create **paused Google Search and Meta Sales campaigns**. Campaign specifications are JSON; rendering, validation, and account operations can be invoked by a CLI, agent, or MCP wrapper. No command enables ad delivery.

## Install

Use Node 22 or newer, Python 3.12 or newer, and FFmpeg with the `subtitles` filter (libass). Install dependencies from this directory:

```sh
npm ci
npx playwright install chromium
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm test
.venv/bin/python -m unittest discover -s test -p 'test_*.py' -v
```

The tests encode a short captioned video and inspect real Google Ads SDK messages without accessing an ad account. The path-gated `web-io` CI job runs these checks and feeds the existing `ci-gate`.

## Render assets

Store campaign manifests, product captures, narration, music, and exports outside this public repository. Paths in a manifest are relative to that manifest. A minimal image manifest is:

```json
{
  "id": "next-step-portrait",
  "format": "portrait",
  "static": true,
  "eyebrow": "Adaptive Math Pathways",
  "cta": "Try the free assessment",
  "detail": "Up to 100 problems · amp.corpora.inc",
  "scenes": [
    {
      "heading": "Their next step\nin math.",
      "body": "Find where to begin. Practice what comes next.",
      "image": "product-example.png",
      "seconds": 5
    }
  ]
}
```

```sh
node render.mjs /path/to/manifest.json /path/to/exports
```

Formats: `square` (1080×1080), `portrait` (1080×1350), `vertical` (1080×1920), and `landscape` (1920×1080). Copy must fit its format; the renderer rejects portrait copy/media/CTA overlaps. Use shorter copy for square placements.

Omit `static` to encode a video. Each scene accepts either `image` or `video`; video scenes can specify a starting offset in `start`. Top-level `voice`, `music`, and `captions` accept local audio and SRT files. Supply `voiceDisclosure` with generated narration and `musicRights` with the music's provenance. Include the appropriate disclosure in the visible `disclosure` field or the platform description; metadata alone is not an audience disclosure.

Exports include a verification JSON with source and output SHA-256 hashes, measured layout boxes, dimensions, duration, and codecs. A hash proves which files were used; it does not prove permission, mathematical accuracy, or an advertising claim. Review each final asset at phone size, listen to the complete soundtrack, and check platform previews before release. A demonstration learner's initial estimates must not be presented as learning gains.

`narrate.py` generates built-in Cedar or Marin narration through OpenAI. It requires `OPENAI_API_KEY` in the process environment and saves the script, model, and voice alongside the WAV. It makes a billable API request. Do not commit keys, voice files, or learner information.

```sh
python narrate.py /path/to/script.txt /path/to/voice.wav --voice cedar
```

## Google Search campaigns

[`examples/search.json`](examples/search.json) illustrates the specification, with a nominal example budget. It is not an approved spending plan. Money is expressed in millionths of a US dollar. The destination must be an HTTPS Corpora URL. Each ad group has exact or phrase keywords and one responsive search ad. Copy limits are checked before platform access.

```sh
python campaigns.py validate --spec /path/to/search.json
python campaigns.py plan --spec /path/to/search.json
```

Without `--config`, `plan` is an offline proposal. It does not inspect an account or validate platform eligibility. An external operator configuration has this shape:

```json
{
  "customer_id": "0000000000",
  "allowed_customer_ids": ["0000000000"],
  "login_customer_id": "0000000000",
  "credentials": "/private/path/google-ads-token.json",
  "max_daily_budget_micros": 1000000
}
```

Use the intended advertiser as `customer_id`; omit `login_customer_id` when not using a manager. The allowlist and explicit budget ceiling reduce accidental account/budget selection. Keep actual configuration, account IDs, reports, and access procedures in the private infrastructure repository or approved operational storage. Tokens belong in approved secret storage, never in Git.

`auth-google.py` obtains a separate Ads-scoped OAuth token from an authorized installed-app client. It binds to loopback, checks OAuth state, and creates a new owner-readable credential file without overwriting existing credentials. This requires the account owner's interactive sign-in and any security-key challenge. It does not provision API project access or change other applications' tokens.

After authorizing API access:

```sh
python campaigns.py inspect --config /private/path/operator.json --output /private/path/inventory.json
python campaigns.py plan --config /private/path/operator.json --spec /private/path/search.json
python campaigns.py apply-paused --config /private/path/operator.json --spec /private/path/search.json --output /private/path/receipt.json
python campaigns.py report --config /private/path/operator.json --output /private/path/report.json
```

Online `plan` validates an atomic Google Ads mutation without creating resources. `apply-paused` repeats validation, creates a new campaign with paused ad groups and ads, then reads back delivery state, budget, network settings, bids, URLs, and copy. It resolves Arkansas's state target from Google's geo catalog, uses physical-presence targeting, and disables search partners and Display. Campaigns use manual CPC until conversion measurement and bidding strategy have been deliberately reviewed.

Campaign names include a specification fingerprint. Repeating a specification reads and verifies the matching campaign without writing. A different revision under the same campaign slug is refused. Uncertain writes are not automatically retried; run inspection before another attempt. Concurrent applies for the same specification are unsupported: use one operator at a time. Google campaign names are not a uniqueness constraint.

The readback does not certify platform approval, audience delivery, conversion tracking, or every criterion against later manual changes. Before activation, inspect all geographic, language, keyword, exclusion, budget, destination, and conversion settings in the platform. Reports contain platform-attributed conversions; these are not proof of paid or fulfilled EFA orders. Reconcile revenue with verified payment records and refunds.

## Meta Sales campaigns

`meta.py` uses Marketing API v26.0 over authenticated HTTPS. It uploads local PNG/JPEG images and MP4 videos, creates unpublished creatives, and creates paused campaigns, ad sets and ads. It requires an authorized Marketing API token with access to the advertiser, Page and purchase dataset. Instagram requires a connected professional account. No token acquisition, billing setup, Page/Instagram creation, pixel installation or conversion export is included.

Start with [`examples/meta.json`](examples/meta.json). The example budget is nominal, not an approved spending plan. Each specification has one publisher (`facebook` or `instagram`), one placement group (`feed` or `vertical`), and one creative. `vertical` selects that publisher's Stories and Reels. `image` is the static creative or video thumbnail; optional `video` supplies the MP4. Paths are relative to the specification and must resolve inside the operator's `media_root`. Images are bounded to 20 MiB; videos to 100 MiB. Render and review media in the intended aspect ratio before upload.

The campaign uses Sales, website Purchase optimization, a seven-day click attribution window, and ad-set budgeting in USD cents. Targeting resolves Arkansas from Meta's catalog, includes adults 18 and older, uses Meta's combined home/recent location semantics, and selects only the specified placements. This does not identify EFA recipients or guarantee Arkansas residency. Advantage audience is disabled. Creative enhancement and multi-advertiser enrollment are explicitly opted out. Platform acceptance and previews must confirm these settings; an offline specification is not proof of API eligibility.

Store the operator configuration outside this public repository:

```json
{
  "account_id": "000000000000000",
  "allowed_account_ids": ["000000000000000"],
  "page_id": "000000000000000",
  "pixel_id": "000000000000000",
  "credentials": "/private/path/meta-token.json",
  "media_root": "/private/path/campaign-media",
  "max_daily_budget_cents": 100
}
```

Add `instagram_user_id` for Instagram. The token file contains `{"access_token":"..."}` and must have mode `600`. Keep it in approved secret storage; never commit it. The token travels in an authorization header, not URL parameters. Redirects and environment proxies are disabled, and Graph error bodies are not printed.

```sh
python meta.py validate --spec /private/path/meta.json
python meta.py inspect --config /private/path/meta-operator.json --output /private/path/meta-inventory.json
python meta.py plan --config /private/path/meta-operator.json --spec /private/path/meta.json --output /private/path/meta-plan.json
python meta.py apply-paused --config /private/path/meta-operator.json --spec /private/path/meta.json --journal /private/path/meta-journal.json --output /private/path/meta-receipt.json
```

`plan` checks account identity/currency, dataset access, the Page connection, geographic lookup and local media. It does not submit mutation validation or create resources. `apply-paused` writes a private, locked journal before each mutation and reads back created resources. Fingerprints bind the exact copy, media hashes, placement, budget and account identities. Output files are private and never overwritten.

Use one operator per advertiser across machines and journals. The journal prevents concurrent use of itself; it is not a distributed lock. Meta campaign names are not unique. An existing campaign with the same slug outside the journal stops creation, including a different revision. Coordinate with anyone using Ads Manager and inspect the existing browser drafts before applying a new specification.

For a video still processing, rerun with the same journal after processing completes; the upload is retained. A network failure or rejected mutation leaves a pending journal entry and stops automatic retry. Inspect Ads Manager and the private account inventory to reconcile the result before changing that journal. Never discard a pending journal merely to retry: a resource may already exist. Partial campaigns remain paused; no rollback deletion is attempted. A crash while writing the journal can require manual recovery from platform inventory.

Readback checks delivery status, budget, destination, identity, copy and targeting. Unexpected targeting fields stop the command for review. Platform review, billing, dataset integration, actual conversion delivery and visual previews remain separate launch checks. Tests cover request construction, pagination, interrupted writes, video processing, duplicate prevention, privacy and paused readback using synthetic responses; they do not certify live Meta access.

API fields are checked against Meta's [official Python Business SDK](https://github.com/facebook/facebook-python-business-sdk/tree/main/facebook_business/adobjects), including [campaign/ad-set/upload operations](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py) and [creative video data](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativevideodata.py).

## MCP access

Meta account setup and authorization must be completed in Meta's supported administration surfaces before its Marketing API or Ads MCP can be used. Do not substitute browser cookies or undocumented endpoints for API credentials.

Google's official Ads MCP is read-only; use the supported Google Ads client for mutations. Meta exposes an official Ads MCP endpoint, but dynamic client registration is not available to every client. Treat an OAuth registration rejection as an access prerequisite, not a successful connection.

References: [Google Ads MCP](https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server), [Google Ads API access](https://developers.google.com/google-ads/api/docs/get-started/introduction), [Meta Ads MCP resource metadata](https://mcp.facebook.com/.well-known/oauth-protected-resource/ads), [OpenAI text-to-speech](https://platform.openai.com/docs/guides/text-to-speech).
