# Localization audit — app + production packs (54 locales)

_Audit date: 2026-06-16. Read-only; no fixes applied._

**Canonical 54 locales** = dirs in `corpan-app/public/locales/`:
`ar bg bn ca cs da de el en es fa fi fr gu he hi hr hu id it ja jv kn ko-polite
lt mr ms ne nl no pa-Arab pa-Guru pl pt-BR pt-PT ro ru sk sl sr su sv sw ta te
th tl tr uk ur vi yue-Hant-HK zh-Hans zh-Hant`

**Production packs (11)** = live `encorpora.io/corpan/packs/catalog-v3.json`:
beatlounge, corpan_city, earthgate_reader, hanzipan, hover_runner, juice_squeeze,
pronunciation_coach, stargate_reader, teletron, tutomaton, world_radio.
(`melopan`, `quest-ear` are NOT in production; `*-0.3.5`/`*-legacy` dirs are stale.)

## ✅ Complete
- **App core chrome** `common.json`: 54/54, 731 keys each, identical key sets, no empties.
- **Phrase packs** (24, CloudFront): name/description/topicLocalized all 54/54.
- **tutomaton**: only pack complete on jv/su/tl (manifest desc + internal i18n). Name = brand.

## 🔴 Gap 1 — book-browse UI English for ALL languages
`packs/shared/catalog/src/appShell.ts` requests **19 keys absent from `common.json`**
(every locale → English fallback). Tabs (Books/Narrators), search placeholders, sort
(Latest/Title/Series), Compact/Expanded, and the whole book **detail** screen
(`catalog.detail.*`). The 15 `catalogPaywall.*`/`subscription.*` keys DO exist.
Fix = add the 19 keys to `en/common.json` + `translate_locale*.py` to 54 + (most already
read via `tt()`, so wiring is minimal).

## 🔴 Gap 2 — hardcoded-English in-pack UI (0/54)
- **stargate-reader + earthgate-reader**: settings panel
  (`packs/stargate-reader/src/ui/settingsPanel.ts`: Oscilloscope/Waveform/Word Hold/
  Depth/Swing/Opacity…) + shared reader chrome (`packs/shared/ui/`: commandDrawer
  tabs Now Playing/Library/Browse, narrationSwitcher Languages/Installed/Add a language,
  settingsRows ON/OFF/Advanced/Reset). No i18n seam at all.
- **world-radio**: UI chrome 100% hardcoded English (tabs, filters Popular/Name A–Z/
  Bitrate/Country, search, errors). Only station metadata localized (missing jv/su/tl).

## 🟠 Gap 3 — juice-squeeze UI strings 27/54
`packs/juice-squeeze/src/translations.ts` hand-maintained, base codes only. Missing 25:
`bg ca cs da el fi he hr jv lt ms ne nl no ro sk sl sr su sv sw tl uk yue-Hant-HK`.
Metadata 54/54.

## 🟠 Gap 4 — pervasive jv/su/tl hole (added after most packs generated)
| Surface | Packs missing jv/su/tl |
|---|---|
| Manifest name+desc | earthgate-reader, hanzipan, hover-runner, pronunciation-coach, stargate-reader, world-radio |
| Manifest desc only | teletron |
| Internal i18n (`strings.ts`/`i18n.ts`) | beatlounge, corpan-city, pronunciation-coach, teletron |
| Per-locale JSON | hover-runner (`src/locales/`) |
| Phrase-pack GROUPS (CloudFront label/desc) | all 12 |

Mechanical: re-run each pack's `tools/gen_i18n.py` for jv/su/tl; backfill manifests;
patch phrase-pack groups via `infra/patch-catalog.py`.

## 🟤 Gap 5 — book catalog content (34 books): titles/descriptions English-only (0/54)
`catalog-v2.json` books carry only `title`/`description`. Descriptions are a real gap;
titles arguable (proper nouns).

## Notes
- Live `catalog-v3.json` shows `nameLocalized` 54/54 for several packs whose on-disk
  manifest lacks jv/su/tl — the build backfills missing name locales with the base
  English `name`, so "54/54" there can be English fallback, not real translation.
- corpan_city passes the `requireCompleteLocalization` deploy gate (manifest 54/54) but
  its INTERNAL strings.ts still lacks jv/su/tl.
