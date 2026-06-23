# Catalog handoff: narrator-first model

**Status as of 2026-04-30:** the production catalog at
`s3://corpan-prod/artifacts/catalog-v2.json` has been bootstrapped with the
new narrator-first fields (`characters`, `voiceProfiles`, `books`,
`characterId`, `coverImageUrl`). Cover/avatar/banner artwork is uploaded to
`s3://corpan-prod/artifacts/{books,characters}/`.

The frontend (corpan readers) reads these fields via the shared catalog SDK
and displays narrator profile pages, book cover thumbnails, and a Books /
Narrators tab in the browse UI.

**The next `ttsctl publish` will wipe these fields** unless ttsctl is
updated. This document describes what ttsctl must produce going forward.

The branch where the frontend support landed is `characters`. The
specification and bootstrap scripts are in `corpan/infra/`:

- `generate-catalog-assets.py` — image generation + S3 upload (re-runnable;
  use `--force` to regenerate). Has all prompts inline.
- `patch-catalog.py` — catalog merge + CDN invalidation. Has all narrator,
  voice profile, and book metadata inline.
- `asset-urls.json` — URL map produced by the image generator.
- `catalog-v2.patched.json` — local snapshot of what was uploaded.

---

## What ttsctl must produce

The frontend requires CatalogV2 with these *additional* top-level fields:

```json
{
  "version": 2,
  "generatedAt": "...",
  "narrations": [...],
  "gamePacks": [],

  "characters":    [...],   // NEW — narrator identities
  "voiceProfiles": [...],   // NEW — voice variants per narrator
  "books":         [...]    // NEW — book-level metadata + cover URLs
}
```

Every narration row must additionally carry:

```json
{
  ...,
  "characterId": "ian",
  "coverImageUrl": "https://d38iwc9748jekz.cloudfront.net/books/{bookId}/cover.jpg"
}
```

### Invariants the frontend assumes

1. Every `narration.voiceId` matches some `voiceProfiles[*].id`.
2. Every `voiceProfile.characterId` matches some `characters[*].id`.
3. Every `narration.bookId` matches some `books[*].bookId`.
4. `narration.language` appears in `voiceProfile.supportedLanguages` for that voice.
5. `(bookId, language, voiceId)` is unique across `narrations`.
6. All asset URLs are HTTPS and fully qualified (no relative paths).

The frontend logs `console.warn` on orphans but does not crash. Aim for
these invariants to hold.

---

## Type definitions (frontend ground truth)

The canonical TypeScript shapes live in
`corpan/packs/shared/catalog/src/types.ts`. The relevant types:

```typescript
type VoiceProvider =
  | "chatterbox" | "gemini" | "vertex-tts"
  | "elevenlabs" | "openai" | "platform"

type VoiceSource =
  | { kind: "cloned"
      sourceWaveUrl: string
      sourceWaveSha256: string
      lengthSeconds: number
      recordedAt?: string }
  | { kind: "native" }

type VoiceProfile = {
  id: string                    // matches voiceId on narration rows
  characterId: string
  displayName: string           // variant label, e.g. "Default", "Chill / Clear"
  provider: VoiceProvider
  providerVoiceId?: string      // e.g., the Gemini voice name
  source: VoiceSource
  supportedLanguages: string[]  // ISO codes
  traits?: string[]             // free-form descriptors
  previewClipUrl?: string       // 8–15s mastered M4A
  status: "active" | "experimental" | "deprecated"
  order?: number
}

type Character = {
  id: string                    // stable slug, e.g. "ian"
  displayName: string
  tagline?: string
  bio?: string                  // markdown
  pronouns?: string
  avatarUrl: string
  bannerUrl?: string
  accentColor?: string          // hex or oklch
  links?: { label: string; url: string }[]
  supportedLanguages?: string[] // aggregate; backend may compute or omit
  status: "active" | "deprecated"
  order?: number
}

type BookEntry = {
  bookId: string
  title: string
  description?: string          // markdown
  author?: string
  coverImageUrl: string
  bannerUrl?: string
  series?: string
  volume?: number
  primaryLanguage: string       // ISO code
  tags?: string[]
}
```

---

## Asset URL conventions

The CDN is `https://d38iwc9748jekz.cloudfront.net`, fronted by the S3
bucket `corpan-prod`. CloudFront strips the `artifacts/` prefix:

| Asset             | S3 key                                          | Public URL                                                            |
|-------------------|-------------------------------------------------|-----------------------------------------------------------------------|
| Book cover        | `artifacts/books/{bookId}/cover.jpg`            | `{cdn}/books/{bookId}/cover.jpg`                                      |
| Book banner       | `artifacts/books/{bookId}/banner.jpg`           | `{cdn}/books/{bookId}/banner.jpg`                                     |
| Character avatar  | `artifacts/characters/{characterId}/avatar.jpg` | `{cdn}/characters/{characterId}/avatar.jpg`                           |
| Character banner  | `artifacts/characters/{characterId}/banner.jpg` | `{cdn}/characters/{characterId}/banner.jpg`                           |
| Voice preview     | `artifacts/voices/{voiceProfileId}/preview.m4a` | `{cdn}/voices/{voiceProfileId}/preview.m4a` *(not yet generated)*     |

Sizes / formats:

- Book covers: square (1:1), 1024×1024 JPEG, ~200 KB (matches Spotify/Apple Music vocabulary)
- Avatars: square (1:1), 1024×1024 JPEG
- Banners: landscape ~3:2, 1536×1024 JPEG
- Voice previews: AAC 64 kbps M4A, 8–15 s

`Cache-Control: public, max-age=31536000, immutable` on uploads.

---

## Current data (live in catalog as of 2026-04-30)

### Characters

| id      | displayName | provider focus            | status |
|---------|-------------|---------------------------|--------|
| `ian`   | Ian         | Chatterbox cloned voices  | active |
| `aoede` | Aoede       | Gemini native voice       | active |

### Voice profiles

| id                  | character | provider    | source | displayName     | order |
|---------------------|-----------|-------------|--------|-----------------|-------|
| `ian-narration`     | ian       | chatterbox  | cloned | Default         | 1     |
| `ian-chill-clear`   | ian       | chatterbox  | cloned | Chill / Clear   | 2     |
| `aoede-gemini`      | aoede     | gemini      | native | Aoede           | 1     |

The `cloned` voice profiles' `source.sourceWaveUrl` and `sha256` are **empty
strings** in the bootstrapped catalog because we don't yet have those values
recorded. ttsctl knows where the source WAVs live (`voices/data/*.wav`,
backed up at `s3://corpan-prod/sources/voices/`); please populate these so
the narrator profile UI can show clone provenance correctly. Suggested:

```json
"source": {
  "kind": "cloned",
  "sourceWaveUrl": "https://d38iwc9748jekz.cloudfront.net/voices/sources/ian-new-narration-try-more-chill-clear.wav",
  "sourceWaveSha256": "<hash>",
  "lengthSeconds": 15
}
```

### Books

13 books currently published (Monte Albán, Genesis, four U10 soccer titles,
What Is an Atom, Olmec, Zheng Yi Sao, Volcanoes, two Tolstoy stories,
Skydiving). Full descriptions and tags are in `patch-catalog.py` `BOOK_META`.

---

## Implementation options for ttsctl

Pick one. The frontend doesn't care which.

### Option 1 — ttsctl owns the new fields (recommended)

Move the `CHARACTERS_META`, `VOICE_PROFILES`, and `BOOK_META` blocks from
`patch-catalog.py` into ttsctl as configuration files (e.g.,
`ttsctl/config/characters.yaml`, `voice_profiles.yaml`, `books.yaml`).
`ttsctl publish` reads them and emits the full catalog with all new fields
populated. Single source of truth, no double-writes.

After this lands, `patch-catalog.py` becomes redundant.

### Option 2 — ttsctl merge-preserves

`ttsctl publish` reads the existing `catalog-v2.json` from S3 before
generating, and preserves any unknown top-level fields and unknown
narration-row fields it doesn't recognize. Specifically:

- Top-level: preserve `characters`, `voiceProfiles`, `books` if present.
- Narration row: preserve `characterId`, `coverImageUrl` keyed by `(bookId, language, voiceId)`.

Lower lift but coupling lives in ttsctl's "merge with previous" logic.

### Option 3 — Rerun the patch script (stopgap)

After every `ttsctl publish`, run:

```bash
python3 corpan/infra/patch-catalog.py
```

Brittle but works in a pinch. Don't ship to production this way long-term.

---

## What's NOT yet bootstrapped

- **Voice preview clips** (`previewClipUrl` on each voice profile). The
  narrator profile UI has a Preview button per voice variant. With no clip,
  the button shows "No preview" and is disabled. Producing 8–15s mastered
  M4A samples per voice profile is a natural ttsctl extension.
- **Source-wave provenance** for cloned voice profiles (see above).
- **Book banners.** `bannerUrl` is unset on every BookEntry. Optional —
  only used for visual flourish if the book detail screen ever wants a
  hero banner.
- **More narrators.** Only Ian and Aoede are modeled. As ttsctl adds
  voices, populate the corresponding `Character` and `VoiceProfile` rows.

---

## Verifying after deploy

```bash
curl -s "https://d38iwc9748jekz.cloudfront.net/catalog-v2.json?_t=$(date +%s)" \
  | jq '{characters: (.characters|length),
         voiceProfiles: (.voiceProfiles|length),
         books: (.books|length),
         narrations: (.narrations|length),
         narration_has_characterId: (.narrations[0]|has("characterId"))}'
```

Expected (today): `characters: 2, voiceProfiles: 3, books: 13,
narrations: 219, narration_has_characterId: true`.

---

## Cross-references

- Frontend types: `corpan/packs/shared/catalog/src/types.ts`
- Frontend hydration: `corpan/packs/shared/catalog/src/catalogIndex.ts`
- Frontend rendering: `corpan/packs/shared/catalog/src/appShell.ts`,
  `corpan/packs/shared/catalog/src/narratorDetail.ts`
- Pipeline architecture: `corpan/NARRATION_SYSTEM.md`
- Original design doc: `~/.claude/plans/i-ve-got-an-enormous-shimmering-umbrella.md` (on Skylar's machine)
