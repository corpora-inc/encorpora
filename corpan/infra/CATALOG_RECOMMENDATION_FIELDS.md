# Catalog recommendation fields

The Home "For you" recommendation is **catalog-driven**: copy, artwork, and
ranking priority for each experience come from the catalog entry, so new packs
can be added, prioritized, localized, and surfaced **without an app release**.
The app falls back to a small in-app registry (`corpan-app/src/experiences/registry.ts`)
only for the built-in phrase experience and for catalog entries that don't carry
these fields yet.

## Where it's read
- App: `CatalogGame` (`corpan-app/src/contentPacks/catalog.ts`) parses the
  fields below; `recommend.ts` + `registry.ts` score and rank; `HomeHub.tsx`
  renders name/blurb/icon catalog-first.
- The publisher/backend that emits `catalog-v2.json` (and the v3 catalog) should
  populate these per game entry.

## Fields (all optional, per catalog game entry)

| Field | Type | Meaning |
|-------|------|---------|
| `name` / `nameLocalized` | string / `{lang: string}` | Display name. **Already supported.** `nameLocalized` wins per UI language (exact → base lang → bare `name`). |
| `description` / `descriptionLocalized` | string / `{lang: string}` | One-line blurb shown under the name. **Already supported.** Same locale fallback chain. Keep it to ~1 sentence. |
| `imageUrl` | string (URL) | Tile/hero artwork. **Already supported.** Rendered `object-cover` in a rounded square; falls back to a lucide glyph if absent. |
| `categories` | string[] | Interest tags matched against the user's onboarding picks. Allowed: `read`, `audio`, `games`, `speak`, `study`, `wild`. Each matched tag = **+3** to the score (the dominant signal). |
| `goodForClass` | string[] | User classes this is a strong fit for: `enjoyer`, `learner`, `polyglot`, `kid_native`. Match = **+2**. |
| `recommendOrder` | number | Cold-start order / tiebreak — **lower surfaces earlier** when scores tie. Curated packs use 1–8; leave unset (defaults to 50) for "after the curated set". |
| `kidFriendly` | boolean | Gentle content; **+2** on the child journey (ageBand under_13/teen). |

## Scoring (for reference)
`score = (matched categories × 3) + (class fit × 2) + (kid fit × 2) + (100 − order) × 0.01`.
Ranked desc, ties broken by `recommendOrder`. With no interest signal (user
skipped), ranking falls back to class-fit + order — still sensible, and never
makes the phrase drill the default star.

## Example entry
```json
{
  "id": "earthgate_reader",
  "name": "Earthgate Reader",
  "nameLocalized": { "es": "Lector Earthgate" },
  "description": "Read along to narrated audiobooks — calm, with word-by-word highlighting.",
  "descriptionLocalized": { "es": "Lee junto a audiolibros narrados…" },
  "imageUrl": "https://…/earthgate.png",
  "categories": ["read", "audio"],
  "goodForClass": ["enjoyer", "kid_native", "learner", "polyglot"],
  "recommendOrder": 1,
  "kidFriendly": true
}
```

## Migration note
Until the catalog carries `categories`/`goodForClass`/`recommendOrder`, the app
uses the registry fallback values for the known built-in/pack ids, so ranking is
unchanged. Once emitted, the catalog values take over — no app release needed.
Keep the registry fallback in sync for the built-in `phrase_main` (never a
catalog pack).
