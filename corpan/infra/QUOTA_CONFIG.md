# Remote quota config — change daily caps without an app build

`quota-config.json` lets ops A/B and re-tune the per-pack **daily-quota caps**
(`dailyLimit`, `softNagEvery`) live, without shipping an app release. The app
fetches it at launch and merges any override OVER the baked defaults in
`packs/shared/monetization/src/quotas.ts`.

## Where it lives

| | |
|---|---|
| **Seed (this repo)** | `corpan/infra/quota-config.json` |
| **CDN URL the app fetches** | `https://d38iwc9748jekz.cloudfront.net/quota-config.json` |
| **S3 object** | `s3://corpan-prod/quota-config.json` (bucket root — same place as `app-version.json`) |
| **Client** | `corpan-app/src/util/remoteQuotaConfig.ts` (fetch + validate + cache) |
| **Read seam** | `getQuota(surface)` in `packs/shared/monetization/src/quotas.ts` |

The CDN is the SAME CloudFront distribution that serves `catalog-v2.json` and
`app-version.json` — no new infra. The object is uploaded manually (like
`app-version.json`); there is no Terraform resource for it (the `corpan-prod`
bucket is referenced by name, not managed in `terraform/`).

## Push a cap change (no app build)

1. Edit `corpan/infra/quota-config.json` — change the `dailyLimit` /
   `softNagEvery` you want to test; bump `version` for your own tracking.
2. Upload it to the bucket root:
   ```bash
   aws s3 cp corpan/infra/quota-config.json \
     s3://corpan-prod/quota-config.json \
     --content-type application/json --region us-east-2
   ```
3. Invalidate the CDN path so devices see it promptly:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id E1RDNUCVE70SCI \
     --paths /quota-config.json
   ```
4. It takes effect on each device on its **next app launch** (and next gate
   construction). See "Timing" below.

To roll back: re-upload the seed (the current baked values) or delete the
object entirely (a 404 fails safe to the baked defaults).

## JSON shape

```json
{
  "version": 1,
  "quotas": {
    "<surface>": { "dailyLimit": 20, "softNagEvery": 5 }
  }
}
```

- Only `dailyLimit` and `softNagEvery` are honored. `packId` / `surface` /
  `unitLabel` always stay baked — they cannot be changed remotely.
- `dailyLimit` is clamped to **1..1000**; `softNagEvery` to **1..dailyLimit**.
- Unknown surfaces are ignored. Partial overrides are fine (set just one field,
  or just some surfaces). Surfaces you omit keep their baked values.
- Surfaces today: `phrase_flips`, `parlometron_daily`, `hover_phrases`,
  `juice_phrases`, `hanzipan_chars`, `tutomaton_daily`.

## Fail-safe + privacy

- Anonymous GET only — **no query params carrying user data, no identifiers**,
  just a TTL-window cache-bust integer. `credentials: "omit"`.
- Best-effort: an absent file (404), network error, or malformed/out-of-range
  value degrades to the baked defaults. It **never blocks launch or crashes**.
- A bad value never even gets cached — the client validates + clamps before
  caching, and `getQuota` clamps again defensively.

## Timing / caching semantics

- **Stale-while-revalidate.** At launch the app applies the last-good cached
  config **synchronously** (so a pack that mounts early already sees the most
  recent known override), then refreshes in the background (TTL ~6h) for the
  next launch.
- A **live gate caches its config at construct time.** A config change that
  lands mid-session therefore takes effect on the **next gate construction**
  (e.g. re-entering a pack) and reliably on the **next app launch** — by design.
- First-ever launch with no cache + no network → baked defaults (harmless).
