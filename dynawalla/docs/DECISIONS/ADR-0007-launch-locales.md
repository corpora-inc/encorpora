# ADR-0007 — Five launch locales; Arabic numbering system deferred

**Status:** Accepted. The Arabic numbering-system sub-decision is **open** and must be
recorded here (as an amendment ADR) before `ar` ships.

## Context

Math notation is locale-dependent, and in this product notation **is** the content. In
fr/de/es/pt-BR the decimal separator is a comma and the thousands separator is a period
or a narrow space, so `1.000` means one thousand to a German child and one to an English
one, and a French child writing three-and-a-half writes `3,5`.

Arabic adds two further problems: many Arabic-locale school materials use Eastern
Arabic-Indic digits, and multi-digit numerals and column arithmetic run left-to-right
inside right-to-left text.

The repo has **zero** prior art: no `Intl.NumberFormat` or `toLocaleString` use anywhere
in the Corpán app, and zero CLDR plural-category keys across 55 locale directories.

## Decision

1. **Launch locales are five: `en`, `es`, `pt-BR`, `fr`, `de`.** `ar`, `hi` and
   `zh-Hans` are V1.1.
2. **The number layer is built locale-parametric from day one**, in M2, not M9. A
   `NumberFormat` module owns the decimal separator, grouping separator, numbering
   system and numeral direction, and drives the keypad glyphs, the slate renderer **and
   `judge`** — which normalizes the locale separator before comparison and accepts `3,5`
   in fr/de.
3. **Only the content bill is deferred**, not the architecture. Groundwork for
   Arabic-Indic digits and LTR-forced numerals inside RTL lands at M9 behind the same
   layer.
4. **Plural categories are first class.** Every `PromptSpec` slot that is a count
   declares its CLDR plural key set, and the i18n gate fails the build on a missing
   category for any locale.

## Consequences

- The five launch locales already exercise the decimal-comma path that the architecture
  must get right anyway, so cutting `ar`/`hi`/`zh-Hans` de-risks content without
  weakening the test.
- Gate **C-14** requires every generator's `canonical` and `alsoAccept` to round-trip
  through format→parse in all launch locales. `Q-07` is the device-level assertion.
- The `columnAlgorithm` widget is forced `dir="ltr"` with an explicit test, so it cannot
  mirror under an RTL document direction.
- Word-problem `contextTheme` sets are **locale-scoped assets, authored not translated**
  (gate C-21): per-locale name pools, object pools, currency and unit sets. The CCSS
  compare phrasings ("how many more", "how many fewer") do not map one-to-one across
  languages and need a native-speaker review per locale before those families go active.

## Open sub-decision

Which numbering system `ar` ships with — Eastern Arabic-Indic (`arab`) or Western
(`latn`) — and whether it is a per-child setting. It is a content and pedagogy decision
about which digits a child sees in their own classroom, not a formatting preference.
Record it in an amendment ADR **before** `ar` ships, not in a bug report.
