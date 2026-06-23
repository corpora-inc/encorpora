# NAVIGATION_PLAN — Settings + Library overhaul (target 0.16+)

> **Status:** Plan / sketch only. Target: corpan-app 0.16+. Seeded in
> 0.15.1 because that's when the two-tab Settings modal started showing
> seams. Not building this today — shipping 0.15.1 first.

## Why this exists

The current `SettingsModal` is a Radix `Dialog` with two `Tabs`: **Stacks**
(per-stack config) + **Packs** (catalog + installed). It carried the app
gracefully through 0.14.x but is straining now:

- **Stacks tab** mixes ~10 unrelated controls in one column: theme,
  dismissible intro tip, stack CRUD, text size, rate, language order,
  levels, phrase-pack manager, romanization, scroll-nav, "reconfigure
  stack", analytics toggle, about. Half of these are stack-scoped; half
  are app-global. They share a tab only because there isn't another
  obvious home.
- **Packs tab** mixes seven distinct sections (subscription offer,
  recents, installed packs, discover, dev tools, restore, phrase-pack
  browser). At 0.15.1 we've already had to reorder + collapse the
  phrase-pack section to keep the apps/games above the fold.
- **Content type axis is growing**: phrase packs, reader apps, game
  apps, books/narrations (downloaded narrations span multiple readers),
  downloaded STT models (currently managed inside Parlometron only),
  future on-device TTS models, future on-device LLMs. None of these
  have a natural slot in the current tab structure.

The "two tabs behind a gear" pattern doesn't scale. Time for a
deliberate redesign.

## Target shape

### 1. Three-tab top-level navigation

Replace the current 2 tabs with 3:

- **Stacks** — per-stack settings only. Strip out everything that isn't
  stack-scoped (theme, scroll-nav, analytics, romanization stay if
  per-stack; reset-onboarding moves to App settings).
- **Library** — replaces "Packs". Sub-nav inside it (chip row at the
  top): **Apps & Games · Books · Phrase packs · Models**. Each
  sub-section owns its own listing + install/update/remove
  affordances. Sticky sub-nav so the user can jump between them
  without scrolling the entire tab.
- **App settings** (new) — theme, analytics, reset onboarding, about,
  privacy/terms. Truly global settings.

A 3-tab strip across the top of the Dialog. The Dialog itself stays
modal-driven from the gear icon. No new routing.

### 2. Stacks tab — true stack settings only

What's left after the split:

- Stack CRUD (`StacksManager`)
- Text size + rate
- Language list + order
- Levels
- Base corpus toggle
- Phrase-pack quick-toggle (per-stack on/off for installed packs)
- Phrase-pack pool-size chip + nudge

That's enough for one calm column. Phrase-pack management (install,
buy, remove) moves to Library → Phrase packs.

### 3. Library tab — sub-section by content kind

```
┌─ Library ─────────────────────────────────────┐
│ ◉ Apps & Games  ○ Books  ○ Phrase packs  ○ Models │
├───────────────────────────────────────────────┤
│ (content for the selected sub-section)        │
└───────────────────────────────────────────────┘
```

- **Apps & Games**: Recents + Installed + Discover + Developer Tools.
  Roughly today's Packs tab minus phrase packs.
- **Books**: Browsable / installable narrations (today these live
  inside reader packs). When we eventually let users download
  narrations independently of readers, they show here as a first-class
  category. Drives off a new manifest signal (`type: "book"` or
  `packType: "narration"`) that's already present on the live
  `book_ai_this_week_*` manifests.
- **Phrase packs**: Today's `PhrasePackBrowser` expanded out — full
  filter pill chrome, category pills, search, install/buy. No more
  collapsed-to-1-row hack.
- **Models**: Lists every downloaded model. Today only Parlometron's
  STT (whisper.cpp `ggml-*.bin`). Future: on-device TTS, on-device
  LLM. Each entry shows size, last-used, delete. Owned by the host
  app rather than tucked inside each pack.

### 4. App settings tab — global

Theme · analytics · reset onboarding · about · terms · privacy.

### 5. Main-experience phrase-pack quick-toggle drawer

The biggest UX upgrade — a drawer reachable directly from the main
experience's bottom controls. Tap a small chip → bottom-sheet drawer
opens with:

- Per-stack base-corpus toggle
- Each installed phrase pack's per-stack toggle
- "Manage" link → opens the full settings → Library → Phrase packs

Fast in, fast out. No diving into the gear → Stacks → scroll-to-phrase-packs
just to mute Botany before a Travel session.

Uses Vaul `<Drawer>` from `src/components/ui/drawer.tsx` (currently
unused; ready to adopt). Hosted at the same level as `MainExperience`
so the drawer can render over the main UI without conflicting with
SettingsModal.

A natural slot for it: a small purple chip just above or to the side
of the existing prev / random / next bottom-control row.

## Open design questions

- **Should the sub-nav inside Library be a chip row (today's pattern)
  or a vertical rail on iPad?** Vertical rail would feel native at
  iPad width, but doesn't translate to phones. Probably: chip row at
  every breakpoint, with the chips growing to compact icons + labels
  on iPad. Decide during implementation.
- **Should the drawer-from-main-experience also expose phrase-pack
  install affordances, or just per-stack toggles for already-installed
  packs?** Install probably belongs in the Library; the drawer is for
  "I want this pack ON right now" not "I want to acquire this pack".
  Keep the drawer narrowly toggle-only.
- **Per-tab persistence vs. session-only?** Today we persist
  `corpan:settings-tab` in localStorage. Worth keeping for Library too,
  but the sub-nav state inside Library probably doesn't need to
  persist across modal mounts — usability test.
- **App-settings tab title vs. "Settings" vs. some other word?** The
  modal's overall name is "Settings" already, so a tab also called
  "Settings" would be weird. "App", "General", "Preferences" — try
  options.

## Cost estimate

~3 days of focused design + implementation. Worth doing as a single
0.16 effort once 0.15.1 ships.

- 0.5 day: top-level 2-tab → 3-tab refactor + tab persistence.
- 1 day: Library tab + sub-nav + four sub-section homes.
- 0.5 day: Stacks tab simplification + move-outs.
- 0.5 day: App settings tab + relocations.
- 0.5 day: Main-experience phrase-pack drawer.
- ~Buffer for i18n key additions and the 51-locale translation rollout.

## Not in scope here

- **Sync across devices.** Settings stay on-device until we have
  accounts.
- **Multi-stack model installs.** Today each pack manages its own
  models (Parlometron's STT). When models become host-managed they
  become shareable across packs; UI shift is in this plan, the
  ownership transition is its own thing.
- **Books browser ingestion.** First-class downloadable narrations
  spanning multiple readers is a separate piece of work; the Library
  → Books sub-section is the *destination*, not the source.
