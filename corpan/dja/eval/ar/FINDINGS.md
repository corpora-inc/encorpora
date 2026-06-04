# Arabic audit — findings (2026-06-04)

Trigger: a single 1-star Arabic App Store review, text only **"غير مفهوم"**
("incomprehensible"). Otherwise strong Arabic ratings + active ad spend.
Goal: find what made one user feel the app was unintelligible, and harden
Arabic to A+ everywhere.

## Tooling built (reusable, language-generic)

- `grade_locale.py` — strong-model locale grader. Uses `codex exec` (GPT-5.x)
  via `cor/utils/codex.py`. Grades each key on fluency / accuracy / register /
  terminology / **rtl_safety** (1–5) + verdict + suggested fix. Works with an
  English source (`--source`) or standalone (`--no-source`, for pack strings).
- `sample_corpus.py` — stratified phrase sample from `release.sqlite3`
  (even stride per CEFR level), emits keyed JSON the grader can consume.
- `run.sh` — orchestrates core-app + corpus (+ `packs`) grades.
- Calibration: Gemini isn't installed on this machine; use a Claude subagent
  for a second-opinion overlap when calibration is needed.

## What we RULED OUT (don't re-chase)

- **Locale fallback → English.** `i18n.ts` uses `load:"currentOnly"` +
  `fallbackLng:"en"`, but `detectPreferredLang()` (onboarding/useApplyLang.ts)
  prefix-matches `ar-SA`/`ar-001` → base `ar`, and every `changeLanguage()`
  caller passes a base code from `ALL_LANGUAGES`. An Arabic device never gets
  an English UI from regional-tag resolution.
- **Corpus / TTS / narration.** Owner verified TTS round-trips cleanly through
  Google Translate; MSA is correct. Grader on a 188-phrase stratified sample
  agrees. **No diacritization, no corpus re-translation.** (Kept MSA.)
- **Translation wording, broadly.** `ar/common.json` graded medians 5/5/5/5/5.
  The text is fluent MSA. The review is not about general wording quality.

## Real defects the grader caught (FIXED in ar/common.json)

| Key(s) | Problem | Fix |
|---|---|---|
| `onboarding.voiceGuide.{step2,macStep2}`, `ttsOsTip{IOS,Mac}`, `appleNoVoiceBody` | Named iOS menu `تسهيلات الاستخدام`; Apple's actual Arabic label is `إمكانية الوصول`. Enable-voices steps were **unfollowable** → app's read-aloud seems broken. **Strongest concrete "غير مفهوم" candidate.** | → `إمكانية الوصول` (5×) |
| `dialects.nb-NO` | Latin `mål` welded inside Arabic word: `بوكmål` (rtl_safety=1) | → `بوكمول` |
| `onboarding.welcomeVisit` | Reversed word order: `encorpora.io زر` | → `زر encorpora.io` |
| `onboarding.welcomeTitle`, `footer.aboutCorpan` | Brand inconsistently transliterated `كوربان` (elsewhere Latin `Corpán`) | → `Corpán` |
| `stacks.note/introTip*`, `settings.{packs,stacks}`, `packs.title/devUnlock*`, `packs.phrasePack.allInstalled.manageCta` | "stack" rendered 3 ways (`مجموعة`/`ملف`/`الستاكات`/Eng `Stacks`); "pack" partly English | Unified → `مجموعة`/`المجموعات`, `الحزم`; localized leftover English labels |

Also: `LanguageSynchronizer.tsx` now sets `<html dir/lang>` reactively (RTL
chrome flips as one unit; was piecemeal-only).

## NOT auto-applied (subjective — needs owner call)

The grader (reasoning=medium) is **prescriptive on style** and produced ~50
more "bad"/low flags that are largely opinion, plus some false positives:

- **Masdar vs imperative buttons** — it wants `افتح` over `فتح`, etc. But masdar
  button labels (`فتح`/`حذف`/`إلغاء`) are a valid, common Arabic UI convention.
  Mass-rewriting risks regressing the established voice.
- **False positive**: flagged `onboarding.makePrimaryLanguage` as "doesn't match
  source" — but that string *intentionally* names the UI's own language.
- **Register nuances / mild concision** — e.g. `categories.business` "عمل" vs
  "الأعمال", `الهنغارية` vs `المجرية`. Defensible either way.

Recommendation: ship the objective fixes; treat the stylistic set as optional
polish to apply selectively, not wholesale.

## Packs + corpus (graded 2026-06-04, decision: build only if defects)

- **Corpus** (188-phrase stratified sample): medians 5/5/5/5/5. Excellent.
  ~13 arguable items, mostly naturalness opinion; a couple are genuine meaning
  slips (e.g. `B1:15369` reversed negation "لنغضب…"; `A2:4872` plural→singular).
  ≈1–2% extrapolated → a future targeted corpus-QA pass could mop up, but it is
  NOT the review cause and out of scope now (owner: no re-translation).
- **All packs**: `rtl_safety=5` everywhere (no broken Arabic rendering in
  strings). hover-runner in-game medians 5/5/5/5/5; metadata blurbs 4–5. Flags
  are style/terminology (`التوالي` for streak, `أمل`/`أمِل` diacritic nit, an
  awkward "all-hearing ear" blurb). **No pack localization-string work warranted.**
- **Open visual-only check** (not gradeable from strings): hover-runner &
  juice-squeeze render phrase text via canvas `fillText`. Confirm Arabic shapes
  correctly on-device; build an HTML overlay only if it actually mis-renders.

## Conclusion on "غير مفهوم"

The Arabic is strong across UI, corpus, TTS, and packs. No single smoking gun.
The most plausible concrete trigger is the **wrong iOS Accessibility menu term**
in the voice-setup steps (now fixed) making read-aloud setup unfollowable;
beyond that, likely an outlier/low-info review. The objective fixes + RTL root
hardening + this repeatable grader are the durable improvements.

## Reports
`report.ar.common.json`, `report.ar.corpus.json`, `report.ar.pack.*.json`.
Re-run: `bash run.sh` (core+corpus) or `bash run.sh packs`.
