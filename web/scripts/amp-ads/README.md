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

The Google Ads CLI uses the installed certifi bundle for gRPC certificate verification. The pinned certifi release excludes the affected emSign ECC Root CA - G3 root ([security advisory](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2)). gRPC ships a separate root bundle, so updating certifi alone does not update its default trust. The CLI sets `GRPC_DEFAULT_SSL_ROOTS_FILE_PATH` to certifi before constructing the client, replacing any inherited value; missing or malformed bundles stop the command. Run the CLI in a fresh process: already initialized gRPC transports can cache roots. TLS tests use OpenSSL to generate temporary certificates and a loopback server; no account credentials are required.

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
      "heading": "Your next step\nin math.",
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

Formats: `square` (1080×1080), `portrait` (1080×1350), `vertical` (1080×1920), `reels` (1080×1920), and `landscape` (1920×1080). Copy must fit its format; the renderer rejects portrait copy/media/CTA overlaps. Use shorter copy for square placements.

Use `reels` for Meta Reels placements. It reserves 14% at the top, 6% on each side, and 40% at the bottom, including the larger bottom exclusion for ads with disclosures. These bounds follow [Meta’s Instagram Reels guide](https://www.facebook.com/business/ads-guide/update/video/instagram-reels/outcome-engagement) and [text-overlay guidance](https://www.facebook.com/business/help/980593475366490). The generic `vertical` layout does **not** provide these placement margins.

The Reels layout accepts short headlines and a 920×340 media panel. Prepare a graphic or capture that is readable in that panel; fitting an entire tall product screen can make its text too small. Branding, copy, media, CTA, details, and disclosure must fit the measured safe area. Plain-text SRT captions occupy a separate band between the media and CTA. The renderer rejects markup, overlapping or out-of-range cues, and captions taller than two lines. It renders captions through the same browser as the cards and composites the measured images into the video. The verification file records each caption’s position and timing. Platform previews remain necessary because placement controls and cropping can vary.

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
python campaigns.py report --config /private/path/operator.json --since 2026-10-01 --until 2026-10-21 --output /private/path/report.json
```

Online `plan` validates an atomic Google Ads mutation without creating resources. `apply-paused` repeats validation, creates a new campaign with paused ad groups and ads, then reads back delivery state, budget, network settings, bids, URLs, and copy. It resolves Arkansas's state target from Google's geo catalog, uses physical-presence targeting, and disables search partners and Display. Campaigns use manual CPC until conversion measurement and bidding strategy have been deliberately reviewed.

Campaign names include a specification fingerprint. Repeating a specification reads and verifies the matching campaign without writing. A different revision under the same campaign slug is refused. Uncertain writes are not automatically retried; run inspection before another attempt. Concurrent applies for the same specification are unsupported: use one operator at a time. Google campaign names are not a uniqueness constraint.

The readback does not certify platform approval, audience delivery, conversion tracking, or every criterion against later manual changes. Before activation, inspect all geographic, language, keyword, exclusion, budget, destination, and conversion settings in the platform. Reports contain platform-attributed conversions; these are not proof of paid or fulfilled EFA orders. Reconcile revenue with verified payment records and refunds.

### Comparing campaign delivery with purchases

Google `report` requires `--since` and `--until` as inclusive ISO dates spanning at most 93 days. It returns an object with account identity, USD currency, account time zone, date range, GAQL query and `rows`. `granularity` is `day_ad`; each row identifies one ad on one day under a campaign whose name starts `AMP | AR | ` or `AMP | AZ | `. `campaign_prefixes` records this scope. Historical metrics include paused and removed ads, groups and campaigns. Integer `cost_micros` strings preserve exact spend: divide by 1,000,000 for dollars. Read `rows` from the envelope; do not treat the output as an unscoped list of campaign totals.

Use the date and campaign/ad-group/ad IDs as the row key. Consumers of the earlier day/ad-group format must add the ad ID; multiple variants in a group are separate rows. The `ad` object includes its ID, status, current final URLs and current URL suffix, allowing comparison with the private creative installation receipts. These destinations are current configuration, not historical click evidence. Responsive Search ads combine headlines and descriptions; an ad-level row does not measure each served headline combination. Reconcile the ad's registered creative label with AMP's purchase evidence rather than treating a destination URL as proof that a particular sale came from that ad.

[Google segmentation](https://developers.google.com/google-ads/api/docs/reporting/segmentation) defines these daily rows. [Google conversion metrics](https://support.google.com/google-ads/answer/6270625?hl=en) use interaction dates and configured conversion windows. Meta requests seven-day click attribution and dates actions by conversion time. Both exports carry the advertiser time zone; AMP’s first-party cash evidence uses UTC. [Google date ranges](https://developers.google.com/google-ads/api/docs/query/date-ranges) use the serving account’s time zone. A shared calendar-date label is not necessarily the same time interval. Preserve the metadata, align interval boundaries, and account for conversion lag before comparing spend, assessments and paid orders.

`amp/scripts/report-campaign.ts` reports first-party activity, assessment events and verified EFA cash separately. Creative breakdowns are subsets of totals; do not add them again. Platform conversions are not verified settlements, and net cash is not profit. Empty platform rows do not certify healthy tracking. These read-only reports do not require enabling customer-data uploads, enhanced conversions or learner-event sharing.

## Google Ads Scripts route

Google Ads Scripts can create the same paused Search proposal through [generic API mutations](https://developers.google.com/google-ads/scripts/docs/concepts/mutate). This route uses the advertiser’s Script authorization; it does not require the separate developer-token/OAuth setup used by the direct API CLI.

Export a private, self-contained script from the same validated specification and operator allowlist/budget configuration:

```sh
python campaigns.py export-script --spec /path/to/search.json --config /private/path/operator.json --output /private/path/search-script.js
```

Export does not contact Google or read the credentials file. It serializes the shared operation builder through the v26 protobuf schema, preserves explicit network exclusions, and writes a new owner-readable file without overwriting an existing one. The generated file contains the advertiser ID and belongs outside this public repository.

The bundle starts with `AMP_MODE = "inspect"`. Paste the complete bundle into a manually run Script in the intended advertiser account, authorize it, and run inspection. It checks account identity/currency, resolves Arkansas from the live geo catalog, and detects existing campaign revisions. **Inspection and Preview do not validate the mutation with Google.** They never call `mutateAll`, even when the mode is changed. Platform policy acceptance and review of landing pages and claims are separate requirements.

For an authorized paused setup, review the generated operations and set `AMP_MODE` to `"apply-paused"`, then use Run rather than Preview. The script creates one campaign, its budget, criteria, paused ad groups and paused ads with `partialFailure:false`. It refuses references to existing campaign/ad-group parents. The live readback checks campaign delivery, budget, presence targeting, networks, language/location criteria, negative keywords, positive keywords, bids, URLs and ad text. An existing matching paused campaign is verified without mutation; a conflicting, active, removed or duplicate revision is refused. No mode activates delivery or exports conversions.

Use one operator and one script copy per proposal; do not schedule it. This route has no durable cross-run transaction journal or distributed lock. After a timeout, unsuccessful mutation result, or failed readback, **do not rerun apply**: inspect the account and reconcile the outcome first. Google campaign names are not unique constraints, and an immediately empty search after an uncertain request is not proof that nothing was created. The script itself never retries mutations. Preserve execution logs privately, switch the mode back to inspection after setup, and check actual platform eligibility and previews before any separately authorized spending decision.

## Meta Sales campaigns

`meta.py` uses Marketing API v26.0 over authenticated HTTPS. It uploads local PNG/JPEG images and MP4 videos, creates unpublished creatives, and creates paused campaigns, ad sets and ads. It requires an authorized Marketing API token with access to the advertiser, Page and purchase dataset. Instagram requires a connected professional account. No token acquisition, billing setup, Page/Instagram creation, pixel installation or conversion export is included.

Start with [`examples/meta.json`](examples/meta.json). The example budget is nominal, not an approved spending plan. Each specification has one publisher (`facebook` or `instagram`), one placement group (`feed` or `vertical`), and one creative. `vertical` selects Facebook Reels or Instagram Stories and Reels. Facebook Stories requires Facebook Feed or Instagram Stories alongside it, so it is excluded from the Facebook-only vertical proposal. Feed uses a separate specification and budget. `image` is the static creative or video thumbnail; optional `video` supplies the MP4. Paths are relative to the specification and must resolve inside the operator's `media_root`. Images are bounded to 20 MiB; videos to 100 MiB. Render and review media in the intended aspect ratio before upload.

The campaign uses Sales, website Purchase optimization, a seven-day click attribution window, and ad-set budgeting in USD cents. Targeting resolves Arkansas from Meta's catalog, includes adults 18 and older, explicitly requests `home`, `recent`, and `frequently_in` location types as returned by Meta v26, and selects only the specified placements. This can include people frequently in Arkansas; it does not identify EFA recipients or guarantee Arkansas residency. The verifier requires exactly those three location types and the selected region; additional countries, regions, or location types fail verification. Advantage audience is disabled. Creative enhancement and multi-advertiser enrollment are explicitly opted out. Platform acceptance and previews must confirm these settings; an offline specification is not proof of API eligibility.

Creative requests use individual v26 enhancement controls; the deprecated `standard_enhancements` field is omitted. Readback must confirm every requested control and every additional returned control is `OPT_OUT`. Missing, unknown, or enabled enrollment states stop setup before ad creation. Meta may append a generated suffix to creative names. After verifying the creative's identity, content, destination and controls, the CLI journals a supported name update and verifies the complete creative again. An uncertain update requires reconciliation before retrying; a completed journal replays without another update.

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
python meta.py report --config /private/path/meta-operator.json --since 2026-10-01 --until 2026-10-21 --output /private/path/meta-report.json
```

`plan` checks account identity/currency, dataset access, the Page connection, geographic lookup and local media. It does not submit mutation validation or create resources. `apply-paused` writes a private, locked journal before each mutation and reads back created resources. Fingerprints bind the exact copy, media hashes, placement, budget and account identities. Output files are private and never overwritten.

Use one operator per advertiser across machines and journals. The journal prevents concurrent use of itself; it is not a distributed lock. Meta campaign names are not unique. An existing campaign with the same slug outside the journal stops creation, including a different revision. Coordinate with anyone using Ads Manager and inspect the existing browser drafts before applying a new specification.

For a video still processing, rerun with the same journal after processing completes; the upload is retained. A network failure or rejected mutation leaves a pending journal entry and stops automatic retry. Inspect Ads Manager and the private account inventory to reconcile the result before changing that journal. Never discard a pending journal merely to retry: a resource may already exist. Partial campaigns remain paused; no rollback deletion is attempted. A crash while writing the journal can require manual recovery from platform inventory.

Readback checks delivery status, budget, destination, identity, copy and targeting. Unexpected targeting fields stop the command for review. Platform review, billing, dataset integration, actual conversion delivery and visual previews remain separate launch checks. Tests cover request construction, pagination, interrupted writes, video processing, duplicate prevention, privacy and paused readback using synthetic responses; they do not certify live Meta access.

`report` reads only campaigns whose names begin `AMP | AR | ` or `AMP | AZ | ` and exports daily ad/placement spend, impressions, reach, clicks and attributed actions/values for an inclusive date range of at most 93 days. Its `granularity` is `day_ad_placement`, and `campaign_prefixes` records the scope. It rejects response rows outside the selected campaign IDs/names or daily date interval, and rows without an ad ID. It requests seven-day click attribution and dates actions by conversion time. Preserve the query, inclusive date range and advertiser time zone with the rows. Recent attribution can change, reach cannot be summed across rows, and platform purchase values must be reconciled with verified settlements and refunds. No parent identifiers or learner data are requested. An empty report does not establish healthy tracking.

Meta specifications generate `utm_content` from the campaign slug. AMP's first-party creative breakdown accepts only the fixed labels in `amp/src/analytics/campaign.ts`; the public landing client and database CHECK constraint use the same allowlist. A new creative requires an additive migration extending that constraint, followed by compatible API and client allowlists. Apply the migration before accepting the new label; an unsupported database value rolls back its transaction, including a funded purchase. Do not edit an already applied migration or remove labels referenced by retained financial records. Unrecognized labels contribute only to coarse counts when the client discards them. This attribution is distinct from Meta's own ad IDs and reporting.

API fields are checked against Meta's [official Python Business SDK](https://github.com/facebook/facebook-python-business-sdk/tree/main/facebook_business/adobjects), including [campaign/ad-set/upload operations](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adaccount.py) and [creative video data](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/adcreativevideodata.py).

## MCP access

Meta account setup and authorization must be completed in Meta's supported administration surfaces before its Marketing API or Ads MCP can be used. Do not substitute browser cookies or undocumented endpoints for API credentials.

Google's official Ads MCP is read-only; use the supported Google Ads client for mutations. Meta exposes an official Ads MCP endpoint, but dynamic client registration is not available to every client. Treat an OAuth registration rejection as an access prerequisite, not a successful connection.

References: [Google Ads MCP](https://developers.google.com/google-ads/api/docs/developer-toolkit/mcp-server), [Google Ads API access](https://developers.google.com/google-ads/api/docs/get-started/introduction), [Meta Ads MCP resource metadata](https://mcp.facebook.com/.well-known/oauth-protected-resource/ads), [OpenAI text-to-speech](https://platform.openai.com/docs/guides/text-to-speech).

## Google purchase measurement authorization

Before accepting Google's customer-data declaration or enabling enhanced-conversion uploads, establish eligibility under [Google's customer data policies](https://support.google.com/google-ads/answer/7475709?hl=en). The restriction covers data collected from sites or apps directed to children under 13, even when the selected fields describe an adult purchaser. Adult consent and hashing do not establish that eligibility. Keep exports disabled while the collection surface's classification is unresolved; see the [measurement prerequisites](../../../amp/docs/google-purchase-measurement.md#prerequisites). Paused campaign preparation does not require customer-data uploads.

Add `--measurement` when running `auth-google.py` to request the Data Manager scope alongside Google Ads. The default continues to request Ads only. The helper refuses to overwrite a token file; preserve existing credentials and use a new approved destination when adding scopes. Neither authorization nor a validation-only API request establishes parent permission to share data.

New offline-conversion integrations use Google's [Data Manager API](https://developers.google.com/data-manager/api/devguides/events/google-ads/offline). AMP's [transport contract and outstanding integration requirements](../../../amp/docs/google-purchase-measurement.md) describe the separate adult-permission, verified-payment, delivery and refund responsibilities. Campaign creation does not install this integration.

## AMP copy voice

Address the reader directly with “you” and “your”: “Math that adapts as you learn,”
“Find your next step in math,” and “Every answer shapes your path.” Use “your child”
when the distinction matters. Avoid third-person “they” and “their” in audience-facing
headlines and benefit statements. Arkansas regional variants may test natural
“y’all” wording, such as “Y’all ready for the next step?” Keep those variants
separate from Arizona and national copy. A shared closing line is
“Get ready to take the next step. Get AMP’d!”

Keep shared product creative separate from Arkansas Education Freedom Account and
Arizona Empowerment Scholarship Account editions. Spell out program names in
longer copy, and use EFA or ESA where space is limited. State-specific ads must
link to their matching program page and retain campaign attribution. Describe
vendor approval accurately without promising approval of every individual purchase.
Development-interface footage must be identified as a preview until the feature
is available. Retain historical creative and measurements unchanged; new copy and
media receive versioned source files and change records.
