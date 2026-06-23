# Publisher model — preview / premium narration (Corpán Plus)

How to publish narration packs so **new app versions** gate the full audiobook
behind a Corpán Plus subscription (free preview → paywall → unlock everything),
while **old app versions keep working unchanged**.

> Monetization model: **single subscription unlocks everything.** Per-book IAP is
> retired. The preview is the conversion funnel *to* the subscription — not
> per-book revenue.

---

## The core idea: one catalog entry, two readers

`catalog-v2.json` is the single source of truth. Each narration entry carries
**both** field sets at once, and each runtime reads only the half it understands:

| Field set | Read by | Purpose |
|-----------|---------|---------|
| **Legacy**: `downloadUrl`, `tier`, `purchase` | **old** app versions | one full public ZIP — old clients download the whole book, no paywall (grandfathered) |
| **New**: `totalSegments`, `freeSegments`, `preview`, `full` | **new** app versions (0.16.0+) | preview (public) vs full (Plus-gated, signed) |

The new runtime treats an entry as gated **iff it has both `preview` and `full`**
(`isTwoZipEntry()` in `packs/shared/catalog/src/installManager.ts`). An entry
missing either is invisible to the new Library. The old runtime ignores
`preview`/`full` entirely and just uses `downloadUrl`.

**Backwards-compat guarantee:** keep publishing the legacy full public ZIP at
`downloadUrl` indefinitely. Old clients keep downloading the full book; the
paywall is intentionally "soft" until/unless legacy publishing is ever sunset.
Never remove or sign-gate `downloadUrl` — that would break installed older apps.

---

## Three artifacts per narration

For each narration you publish:

1. **Legacy full ZIP** → `downloadUrl` (public, every segment). *For old clients.*
   Keep publishing this. `tier: "public"`, `purchase` unchanged.
2. **Preview ZIP** → `preview.url` (public, first `freeSegments` segments only).
   *For new non-subscribers.* No auth to download.
3. **Full ZIP** → `full.url` (every segment, `requires: "corpan.plus"`,
   served via **CloudFront signed URL**). *For new subscribers.*

`freeSegments` = `min(floor(totalSegments / 3), 100)` unless you set a per-book
override. The preview ZIP's `segments.json` MUST carry the preview marker so the
reader shows the paywall at the end — either `is_preview: true` or simply
`segments.length < total_segments` (the readers check both).

`NarrationArtifact` shape (`packs/shared/catalog/src/types.ts`):
```jsonc
{ "url": "https://…/book.zip", "sha256": "…", "sizeMb": 12.3, "requires": "corpan.plus" }
```
`requires` is present on `full` (entitlement family) and absent on `preview`.

---

## Catalog entry shape (both halves)

```jsonc
{
  "id": "earthgate-es-the-quiet-earth",
  "title": "The Quiet Earth",
  "language": "es",
  // ── LEGACY (old clients read only these) — keep forever ──
  "downloadUrl": "https://cdn.encorpora.io/narration/.../full-public.zip",
  "tier": "public",
  "purchase": { /* unchanged legacy purchase info */ },
  // ── NEW (0.16.0+ reads only these) ──
  "totalSegments": 540,
  "freeSegments": 100,
  "preview": {
    "url": "https://cdn.encorpora.io/narration/.../preview.zip",
    "sha256": "…", "sizeMb": 2.1
  },
  "full": {
    "url": "https://cdn.encorpora.io/narration/.../full.zip",
    "sha256": "…", "sizeMb": 11.8,
    "requires": "corpan.plus"
  }
}
```

---

## Runtime behavior (what the new app does)

On install (`installNarration` in `installManager.ts`):
- **Subscriber** (`isCurrentlySubscribed()` → entitled): resolves a StoreKit/Play
  receipt, calls the verify Lambda (`requestSignedUrl(full.url, "corpan.plus", …)`),
  downloads the **signed full** ZIP.
- **Non-subscriber**: downloads the **public preview** ZIP (no auth).

In the reader (`earthgate-reader` / `stargate-reader` `game.ts`): when the user
reaches the end of the preview, it dispatches `corpan:request-unlock`
(`surface: "reader_eof_free"`), which `App.tsx` turns into the Plus paywall
("You've reached the end of the free preview of {{title}}"). Subscribing unlocks
**all** narration (the user re-installs the full ZIP on next open / re-tap).

The CloudFront `full.url` must be **signed-URL only** (origin not publicly
readable) so the gate can't be bypassed — the free user never receives the paid
bytes. The `preview.url` and legacy `downloadUrl` are public.

---

## Publish checklist (per narration)

1. Render/segment the narration → produce `segments.json` with `total_segments`.
2. Emit the **preview** ZIP: first `freeSegments` segments, with the preview
   marker (`is_preview: true`), uploaded **public**.
3. Emit the **full** ZIP: all segments, uploaded to the **signed-only** origin.
4. Keep emitting the **legacy full public** ZIP at the existing `downloadUrl`.
5. Compute `sha256` + `sizeMb` for `preview` and `full`.
6. Merge `totalSegments`, `freeSegments`, `preview`, `full` into the catalog
   entry **without removing** `downloadUrl`/`tier`/`purchase`.
7. Publish `catalog-v2.json` to the CDN and invalidate CloudFront
   (~10–30s; same pattern as the existing catalog publish).

For existing entries, `infra/scripts/backfill_two_zip.py` adds the new fields to
legacy entries (dry-run first). Wire the per-narration emit into `ttsctl publish`
(a `--with-preview` flag is the intended home for steps 2–6).

---

## Verify it works (no real purchase needed)

- **Non-subscriber, new app**: install a two-zip narration → you get the preview
  → read to the end → the paywall appears.
- **Old app**: same entry installs the full legacy ZIP → no paywall (correct).
- **Backend gate**: confirm `full.url` returns 403 without a signed URL, and the
  verify Lambda only signs it for an active Plus subscription.
- The app side is already verified: dispatching `corpan:request-unlock`
  `{surface:"reader_eof_free"}` opens the paywall with the book-preview copy.

---

Related: `corpan-app/CLAUDE.md` (Corpán Plus architecture), `infra/PUBLISHING.md`
(legacy publish), `packs/shared/catalog/src/{installManager,types}.ts`,
`corpan-app/src/components/paywall/PaywallSheet.tsx`, `corpan-app/src/store/paywall.ts`.
