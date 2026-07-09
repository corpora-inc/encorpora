# Changelog — imagepan (concept picture pack)

All notable changes to the `imagepan` pack and its build/publish tooling are
documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning: [SemVer](https://semver.org/spec/v2.0.0.html).
Conventions: `corpan/CHANGELOGS.md`.

## [Unreleased]

### Added
- **Publish tooling** — `publish_image_pack.py` uploads the built pack to
  S3/CloudFront (immutable versioned zip + accumulate-merged `index.json`),
  mirroring `dja/journey_pack/publish_journey_pack.py`. `--dry-run` prints the
  index entry without uploading. Nothing publishes without running it.
- **App delivery wiring** (in corpan-app; ships inert): a dedicated image-pack
  index parser, a lazy auto-install that registers the pack in a generic
  installed-data-pack store when a Journey session opens, and the sync
  recognition gate the resolver reads. Degrades to a clean no-op when the pack
  is not yet published.

### Notes
- Pack `0.1.0` built from the owner-curated `verdicts.json`: 95 concepts,
  ~1.0 MB (WebP + SQLite). Not yet published to CloudFront (owner authorizes).
