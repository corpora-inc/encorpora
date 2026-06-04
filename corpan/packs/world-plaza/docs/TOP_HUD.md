# World Plaza — Top HUD (the chrome redesign)

**Status:** Design + sequenced plan. NO code in this doc — it is the spec the
implementation fans out from. Owns the **top-of-screen chrome** only: what
information lives up top, how it consolidates, how it behaves across every screen
size, and the **visibility state machine** that hides chrome during
dialogue/challenge/menu (fixing today's pack-button-over-NPC-window overlap).

Reads from: `ROADMAP.md` (the per-pair **Track** spine), `ECONOMY_CURRENCY.md`
(coins/XP are moving INTO the wallet/pack → the top HUD needs no prominent coin
readout), `BADGES_PROGRESSION.md` (the static `✨` integer becomes a focus-badge
chip), `IMMERSION_TOGGLE.md` + `LANGUAGE_PAIR_STATE.md` (which Track you're playing
is now meaningful, switchable state, and immersion selects which locale the chrome
renders in). Touches the current code: `game.ts` (`.wp-title`, `.wp-coinhud`),
`questTracker.ts` (`.wp-tracker`), `styles.css` z-scale + `shell/shell.ts`
(`menuButton.hide()/show()`, `onPause`/`onResume`, `openSection`).

**Author intent (verbatim spine):** the top chrome needs a holistic, **over-the-top
premium** redesign that "looks great for all sizes of screens." Prefer **"just a
left and right thing"** — consolidate, don't scatter 3+ elements. Coins/XP are
refactoring into the pack (bottom-right satchel) → the top HUD does NOT need a
prominent coin/XP readout. The scene name **"Antigua · 1770" doesn't need to be so
prominent.** Explore (A) combine title + scores into one top-right element, and (B)
the whole of quest + location + top-level scores as ONE element that **expands for
detail** — recommend.

**The non-negotiable bar:** A++ premium / understated / elegant (no Duolingo dark
patterns); phone (portrait + landscape) + tablet + desktop ALL first-class; every
surface mounts INSIDE `.wp-overlay` (the M0 lesson — never `document.body`);
safe-area aware; localized (~50 langs, respects immersion + the Track's languages);
reduced-motion + a11y; compositor-only animation; no placeholders.

---

## 0. The recommendation, up front

**Adopt a hybrid of A and B: a two-anchor top bar where the LEFT anchor is the
Quest+Track status (the keystone, expandable) and the RIGHT anchor is a quiet,
de-emphasized Place/Presence tag.** Concretely:

- **LEFT = the Status Capsule** (the evolved quest tracker). It owns the quest
  objective + next-hint (today's tracker, kept — the owner said it's good), and
  **absorbs the Track identity** (the flag-pair + immersion pip + a wealth/badge
  *glance*). It is the **one expandable element** of idea B: a glanceable capsule
  that taps open into a detail card (quest detail · location/era lore · wealth &
  focus-badge glance that deep-link into the pack). This is the primary, content-
  bearing anchor.
- **RIGHT = the Place Tag** — the scene name + presence, **demoted** to a small,
  low-contrast tag (idea A's "title moves out of center," but we do NOT bolt scores
  onto it; scores live in the pack now). It carries `Antigua · 1770` + an online-
  presence pip, nothing else. On phone-portrait it collapses to an icon-only pip.

Why this split rather than a single centered element or a single all-in-one:

1. **The owner explicitly wants "a left and right thing"** and the quest tracker
   (left) "is good and now sits level with the top row." Keeping the tracker as the
   left anchor honors that and reuses a tested, already-externalized surface.
2. **Idea B's "one expandable element" is realized as the LEFT capsule** — the
   status the player actually acts on (quest) is the thing worth expanding; folding
   the demoted location into the *same* expand would force the location to be
   prominent (it taps), which contradicts "the place name doesn't need to be
   prominent." So location stays a passive RIGHT tag, and the expand lives on the
   LEFT where it earns its tap.
3. **Scores do NOT go top-right** (idea A's literal form) because the economy +
   badges docs move them into the pack; a prominent top-right wallet would
   duplicate the satchel and re-clutter exactly the corner we're trying to quiet.
   Instead a *whisper* of wealth/progress rides inside the LEFT capsule's collapsed
   row (a single glance pip, not a readout) and the full detail lives one tap away
   in the pack.

So: **two anchors (left capsule = expandable quest+Track+glance; right tag =
demoted place+presence), the center freed entirely** (today's centered title pill
is retired — its center real estate is reclaimed for the toast/level-up moments).

```
   ┌─ LEFT: Status Capsule (expandable) ─┐            ┌ RIGHT: Place Tag ┐
   │ 🇪🇸→ Quest · Mercado                 │            │ Antigua · 1770 ·● │
   │ • Order a coffee                     │            └──────────────────┘
   │ Find the ferry token   ▸ tap to open │
   └──────────────────────────────────────┘
        (center is empty — toasts/level-up bloom here)
                                                          🎒  ← pack (bottom-right)
```

---

## 1. Inventory of top-of-screen information (decide top-HUD vs pack)

Everything that *could* live up top now and after the refactors, with a verdict.
"Top-HUD" = belongs in the always-on chrome; "Pack" = belongs in the bottom-right
satchel (the full detail surface); "Transient" = appears only in a moment.

| Information | Source (getter/hook) | Verdict | Where / form |
|---|---|---|---|
| **Quest objective** (step label) | `questEngine.currentStep().label` | **Top-HUD (left, primary)** | Capsule objective row (today's `.wp-tracker-objective`) |
| **"What next" hint** (find/deliver/talk) | `questEngine.stepState` + `inventory.has` + `anchorName` | **Top-HUD (left)** | Capsule hint row (today's `.wp-tracker-hint`) |
| **Quest progress** (step N of M) | `questEngine.state()` | **Top-HUD (left, expanded only)** | Moves into the expanded detail card (de-clutters the collapsed glance) |
| **Track / language pair** (which pair you're playing) | `trackManager.active().state.{native,target}` | **Top-HUD (left)** | A flag-pair lozenge `🇬🇧→🇪🇸` prefixing the capsule; **tap-to-switch lives in the pack/menu**, not the HUD |
| **Immersion state** (off/reveal/on) | `immersionResolver.level()` | **Top-HUD (left, pip)** | A tiny immersion pip on the flag-pair (●=on, ◐=reveal, none=off); full control in the menu |
| **Location** (place · era) | `activeScene.setting.{place,era}` | **Top-HUD (right, DEMOTED)** | The quiet Place Tag; era lore in the capsule's expanded card |
| **Wealth glance** (a hint of money, NOT a readout) | `inventory().walletGlance()` (new, §6) | **Top-HUD (left, glance pip) → Pack for detail** | One denomination-icon + abbreviated total in the expanded card header; full wallet in the pack |
| **XP / focus badge** (replaces the `✨` integer) | `badgeStore.focusBadge()` (`BADGES_PROGRESSION` §4.5) | **Top-HUD (left, glance) → Pack for the Badge Case** | The focus-badge chip's glyph+arc rides in the expanded card; tapping deep-links to the pack's Badges tab |
| **Online / presence count** | `net.presenceCount()` (new, §6) | **Top-HUD (right, pip)** | A small "● N" people pip on the Place Tag; absent when solo/offline |
| **Coins readout** (the old `🪙 N`) | — | **REMOVED from top** | Lives in the pack's Wallet tab (`ECONOMY_CURRENCY` §5.2). No prominent top coin. |
| **Level / path progress** | `track.state.levelIndex` / path | **Pack** (+ capsule expanded summary line) | The path/level UI is a pack/menu concern; the capsule may show "Level 3" in its expanded summary only |
| **Bottom hint string** ("Left half: move…") | static | **Transient → onboarding** | First-run coaching, fades after; not permanent chrome (see §2.6) |

**The principle:** the **top HUD is the glance; the pack is the ledger.** Anything
with detail (full wallet, the 1000-badge case, level/path, track switching) lives in
the bottom-right satchel; the top only ever shows *one line of each* — what you're
doing (quest), where/who (place+presence), and a *whisper* of how you're doing
(wealth/badge glance) — with the LEFT capsule's expand bridging glance→pack.

---

## 2. Layout system — two anchors + the responsive matrix

### 2.1 The anchors (structure)

Two `position:absolute` children of `.wp-overlay`, pinned to the top corners,
safe-area-inset aware on all four sides. The center is intentionally empty.

```
.wp-overlay (z:10)
├── .wp-status     ← LEFT anchor  (top-left)  — the Status Capsule (expandable)
│   ├── .wp-status-glance      (always shown: flag-pair · quest · objective · hint)
│   └── .wp-status-detail      (revealed on expand; in-overlay, NOT document.body)
└── .wp-placetag   ← RIGHT anchor (top-right) — demoted place · era · presence pip
```

The LEFT `.wp-status` **replaces and absorbs** today's `.wp-tracker` (the quest
tracker keeps its internals — objective/hint/progress rows, the gentle pulse dot,
its externalized `strings`/`anchorName`/`itemLabel` resolvers — and gains the
flag-pair prefix, the immersion pip, the glance pips, and the expand affordance).
The RIGHT `.wp-placetag` **replaces** today's centered `.wp-title` and the
top-right `.wp-coinhud` (both retired). The center title pill is gone.

### 2.2 Collapsed glance vs expanded detail (the LEFT capsule)

- **Collapsed (default):** a single capsule, max ~3 short rows:
  - row 1 (head): `🇬🇧→🇪🇸●` flag-pair + immersion pip · `Quest · Mercado` (quest title, de-emphasized)
  - row 2 (objective): `• Order a coffee` (the live objective, the pulse dot)
  - row 3 (hint): `Find the ferry token` (flips with step state)
  - a quiet `▸` affordance at the trailing edge signalling "tap for detail"
- **Expanded (tap / Enter / click):** the capsule grows a **detail card** *in place*
  (anchored under the glance, inside `.wp-overlay`), revealing: full quest progress
  (step N of M + the step list), the **location/era lore** line (pulled from the
  demoted Place Tag's scene), a **wealth glance** (top currency icon + abbreviated
  total) and the **focus-badge** (glyph + arc), each a button that **deep-links into
  the pack** (`shell.openSection("wallet")` / `"badges")` / `"quest")`). See §3.

### 2.3 Responsive matrix (exact behavior per form factor)

Breakpoints follow the pack's existing `clamp()`/media conventions
(`max-width: 540px` = phone; `hover:hover and pointer:fine` = desktop). Tablet is
the band between. **Tablet + desktop are first-class, not phone-scaled** (MEMORY
rule): wider screens show *more*, denser, with the expand open-on-hover, not a
shrunk phone layout.

| Surface | Phone portrait (≤540px) | Phone landscape (short height) | Tablet (541–1024px) | Desktop (≥1025px, fine pointer) |
|---|---|---|---|---|
| **LEFT capsule width** | `min(70vw, 300px)` | `min(52vw, 320px)` (height-constrained → keep narrow) | `min(46vw, 360px)` | `clamp(320px, 26vw, 420px)` |
| **LEFT rows shown collapsed** | flag-pair + objective + hint (quest title folds into objective head as a tiny prefix to save a row) | **objective + hint only** (flag-pair shrinks to a pip; landscape height is precious) | all 3 rows comfortably | all 3 rows, larger type, the `▸` is a visible "Details" pill |
| **LEFT expand trigger** | tap the capsule | tap | tap **or** hover-peek | **hover-peek** (auto-expands on hover, collapses on leave) + click to pin |
| **LEFT expanded card** | full-width bottom-sheet-style panel anchored to the capsule, scrollable | a compact popover (height-capped, internally scrolls) | inline card under the capsule | inline card; wealth/badge/lore as a 2-col grid |
| **RIGHT Place Tag** | **icon-only**: a 📍 + presence pip (place/era text hidden; full text in the expanded lore) | place abbreviated (`Antigua`) + pip | `Antigua · 1770` + pip | `Antigua · 1770` + `● N online` (count labelled) |
| **Presence pip** | dot only (●) | dot + count if >1 | dot + count | dot + "N online" word |
| **Center** | empty (toast bloom zone) | empty | empty | empty |
| **Pack button (bottom-right)** | 50px tap target | 50px | 48px | 44px (fine pointer) |

**Never-overlap guarantees (the layout contract):**
- The LEFT capsule and RIGHT tag are corner-pinned with a **center gutter** — on the
  narrowest phone the LEFT `max-width: 70vw` + the RIGHT icon-only tag (~15vw) leave
  a center gutter; they can never collide because neither is center-anchored and
  their combined max-width < 100vw at every breakpoint.
- The **expanded** LEFT card is height-capped (`max-height: min(60vh, 420px)`,
  internal scroll) so it never reaches the **bottom** dialogue/joystick/Talk/pack
  zones. On phone-landscape (short height) it caps tighter (`max-height: 80vh` of a
  small viewport, popover style).
- Nothing in the top band may extend below the **dialogue top edge** or over the
  bottom **joystick/Talk/pack** zones — enforced by the visibility state machine
  (§4): the whole top band *recedes* the moment a dialogue/challenge/menu opens.
- All four safe-area insets respected (`env(safe-area-inset-*)`), matching the
  existing `.wp-tracker`/`.wp-coinhud`/`.wp-menu-button` rules.

### 2.4 ASCII mockups

**Phone portrait (≤540px) — collapsed:**
```
┌───────────────────────────────────────┐
│ ┌─────────────────────┐        ┌────┐  │  ← safe-area top
│ │🇬🇧→🇪🇸● Mercado       │        │📍 ●│  │
│ │ • Order a coffee     │        └────┘  │
│ │ Find the ferry token │        place   │
│ └──────────────────────┘        +pres.  │
│                                          │
│              (world)                     │
│                                          │
│                                          │
│      ┌──────────────────────┐            │
│      │   💬  Talk            │            │
│      └──────────────────────┘            │
│  ◯ move-stick      look-stick ◯    🎒    │  ← pack bottom-right
└───────────────────────────────────────┘
```

**Phone portrait — LEFT expanded (tapped):**
```
┌───────────────────────────────────────┐
│ ┌──────────────────────────────────┐   │
│ │🇬🇧→🇪🇸 ● immersion: reveal      ✕ │   │
│ │ Quest · Mercado de Antigua        │   │
│ │ • Order a coffee                  │   │
│ │ Step 2 of 5  ▓▓▓░░                │   │
│ │ ─────────────────────────────     │   │
│ │ 📍 Antigua, Guatemala · 1770      │   │
│ │   "A colonial market morning."    │   │  ← location/era lore
│ │ ─────────────────────────────     │   │
│ │ [💵 R 18.40  ▸ Wallet]            │   │  ← deep-link to pack
│ │ [🏅 Café · Bronze 60% ▸ Badges]   │   │  ← deep-link to pack
│ └──────────────────────────────────┘   │
│              (world dimmed behind)      │
└───────────────────────────────────────┘
```

**Tablet (collapsed, roomier):**
```
┌──────────────────────────────────────────────────────────┐
│ ┌────────────────────────────────┐         ┌────────────┐ │
│ │🇬🇧→🇪🇸 ●  Quest · Mercado        │         │Antigua·1770│ │
│ │ • Order a coffee     [Details ▸]│         │  ● 3 online│ │
│ │ Find the ferry token            │         └────────────┘ │
│ └─────────────────────────────────┘                        │
│                                                              │
│                       (world)                                │
│                                                              │
│                  ┌──────────┐                                │
│                  │ 💬 Talk   │                          🎒   │
│                  └──────────┘                                │
└──────────────────────────────────────────────────────────┘
```

**Desktop (≥1025px, hover-peek expands inline):**
```
┌──────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────────────────────┐       ┌───────────────┐ │
│ │🇬🇧→🇪🇸 ●   Quest · Mercado de Antigua  │       │Antigua · 1770 │ │
│ │ • Order a coffee                       │       │  ● 3 online   │ │
│ │ Find the ferry token                   │       └───────────────┘ │
│ │ ── (hover) ───────────────────────     │                         │
│ │ Step 2 of 5 ▓▓▓░░                       │                         │
│ │ 📍 Antigua · 1770 — colonial morning    │                         │
│ │ 💵 R 18.40 ▸Wallet   🏅 Café·Bronze ▸  │                         │
│ └────────────────────────────────────────┘                         │
│                            (world)                          🎒      │
└──────────────────────────────────────────────────────────────────┘
```

### 2.5 The pack button (bottom-right) — unchanged anchor, governed visibility

The satchel stays bottom-right (it is the full ledger; the top is the glance). It is
NOT a top-HUD element, but it shares the **visibility state machine** (§4) so it
recedes during dialogue/challenge (fixing the overlap bug). No layout change to the
button itself.

### 2.6 The bottom hint string (retire from permanent chrome)

Today's `.wp-hint` ("Left half: move · Right half: look · …") is permanent center-
bottom clutter. **Demote it to first-run coaching:** show it on first session, fade
it after the player moves / after ~8s, and never show it as permanent chrome. (Owned
loosely here; the onboarding doc may relocate it entirely.) This frees the bottom-
center the same way we free the top-center.

---

## 3. The expandable element (the LEFT capsule's detail card)

This is idea B realized: **one element that expands for more detail.**

### 3.1 Collapsed → expanded (in-overlay, the M0 lesson)

- The detail card mounts **inside `.wp-status`**, which is inside `.wp-overlay` —
  **never `document.body`** (the M0 root-cause: a body-fixed panel is clipped when
  embedded in Corpán). It is `position:absolute` anchored to the capsule's top-left,
  growing downward; on phone-landscape it becomes a height-capped popover.
- **Trigger:** tap/click/Enter on the capsule (touch + phone); **hover-peek** on
  desktop (auto-expand on hover, click to pin so it stays). Esc / tap-scrim / tap
  the `✕` collapses. Keyboard: the capsule is `tabIndex=0`, `role="button"`,
  `aria-expanded` toggles; the detail card is focus-trapped while pinned.

### 3.2 What it reveals (glance → pack bridges)

1. **Quest detail** — full title, `Step N of M` with a slim progress bar, and the
   step list (done/active/upcoming). A `▸ Open quest` button → `shell.openSection("quest")`.
2. **Location / era lore** — `place, region · era` + a one-line authored flavor
   string from the Scene (`scene.setting.lore`, a new optional field; falls back to
   `place · era` if absent). This is where the demoted RIGHT tag's detail surfaces —
   the place is quiet up top, rich on demand.
3. **Wealth glance** — the **top-held currency** decomposed icon + abbreviated major
   total (`💵 R 18.40`, from `inventory().walletGlance()`, §6). A button
   `▸ Wallet` → `shell.openSection("wallet")`. **Not a full wallet** — a whisper that
   deep-links to the pack's full multi-currency view (`ECONOMY_CURRENCY` §5.2/§5.4).
4. **Focus badge** — the badge nearest its next tier (glyph + tier + arc %, from
   `badgeStore.focusBadge()`, `BADGES_PROGRESSION` §4.5). A button `▸ Badges` →
   `shell.openSection("badges")`. **This is where the old `✨` integer's replacement
   lives** — as named, glanceable progress, deep-linking to the Badge Case.
5. **Immersion** — shows the current level (`off · reveal · on`) as a read-only line;
   the *control* lives in the menu (`IMMERSION_TOGGLE` §5.1), the capsule just states
   it and offers `▸ Change` → `shell.openSection("quest")` (where the toggle row lives).

### 3.3 Relationship to the satchel/menu (glance vs ledger)

- **The capsule is the glance; the pack is the ledger.** Every detail-card row that
  shows a *number/total* is a **button that deep-links** into the corresponding pack
  tab — the top never duplicates the pack's full surface, it *previews + routes*.
- This keeps a single source of truth: the wallet renders fully in the pack
  (`getWalletView()`), the badges in the Badge Case (`badgeCase`), the quest in the
  Quest section — the capsule reads cheap *glances* (`walletGlance`, `focusBadge`,
  `currentStep`) and links onward. No drift, no double-maintained UI.

### 3.4 Animation (compositor-only, dignified)

- Expand/collapse animate **opacity + transform (translateY/scale)** only — no
  layout-triggering width/height transitions (the capsule reserves the card's slot
  via a measured max-height transition that is GPU-cheap, or a clip-path reveal).
- The glance→card reveal is one calm ease (`cubic-bezier(0.22,1,0.36,1)`, ~220ms),
  matching `.wp-menu-panel`. The pulse dot on the objective is the only ambient
  motion (already reduced-motion-gated in `.wp-tracker`). **`prefers-reduced-motion`
  → instant show/hide, no slide.** No bounce, no confetti, no FOMO.

---

## 4. Z-layering + the visibility state machine (fixes the overlap)

### 4.1 The bug being fixed

Today the bottom-right **pack button** (`--wp-z-menu-button: 38`) sits under the NPC
dialogue (`40`) by z-order, but the code comment admits *"Proper hide-during-dialogue
is part of the top-HUD redesign."* The menu button only hides on **menu** open
(`shell.ts` `menuButton.hide()` inside the menu open/close), **not** on dialogue or
challenge — so when an NPC window opens, the satchel still shows and can overlap it.
The top HUD (tracker/title/coins) likewise stays painted during dialogue. **The fix
is a single chrome visibility state machine** that recedes ALL chrome (top band +
pack button) during any blocking surface, not a per-element z-tweak.

### 4.2 The chrome visibility states

One enum drives the whole chrome (top band + pack button), owned by the orchestrator
(`game.ts`) and applied through a tiny `chromeVisibility(state)` helper:

```
type ChromeState =
  | "world"        // free-roam: full chrome visible (capsule + tag + pack)
  | "focused"      // an NPC is focused, Talk button showing — chrome stays (you
                   //   may still want quest/place context) but the pack RECEDES
                   //   slightly so the Talk button is unobstructed
  | "dialogue"     // NPC window open — TOP BAND + PACK fully recede (hidden)
  | "challenge"    // a centered challenge running — TOP BAND + PACK fully recede
  | "menu"         // the pack/menu panel open — chrome recedes (menu IS the surface)
  | "onboarding"   // pre-game / track-picker — no chrome
```

**Transitions (driven by existing seams):**

| Event (existing hook) | → ChromeState | Chrome effect |
|---|---|---|
| boot / `begin()` | `world` | full chrome fades in |
| `onboarding`/picker active | `onboarding` | chrome absent |
| focus locks an NPC (`onFocusChange` target≠null) | `focused` | pack dims to ~0.4, top band stays |
| dialogue opens (`npcRuntime.open`, `engagedId` set) | `dialogue` | **top band + pack hide** (opacity 0, `aria-hidden`, `pointer-events:none`) |
| challenge launches (`runChallenge`) | `challenge` | **top band + pack hide** |
| `shell.onPause` (menu opens) | `menu` | chrome hidden (the existing `menuButton.hide()` generalizes to the whole band) |
| dialogue/challenge closes (`onClose`/`.then/.finally`) | `world` (or `focused` if still near) | chrome returns |
| menu closes (`shell.onResume`) | `world` | chrome returns |

The state machine is **the single owner of chrome opacity/interaction**; no element
hides itself ad hoc. This is the same discipline as `setWorldActive(active)` already
in `game.ts` (which gates input+focus) — we add `setChromeState(state)` alongside it,
fed by the **same** open/close callbacks that already exist (`focus`'s
`onFocusChange`, the dialogue `onClose`, the challenge `.then`, `shell.onPause/
onResume`). No new event plumbing — just route those five existing edges into one
state setter.

### 4.3 Why hide vs z-raise (the M0 discipline, restated)

We do **not** fix the overlap by stacking the dialogue above the chrome and calling
it done — a translucent capsule peeking behind an NPC window is visual noise, and
raising z is the exact anti-pattern the z-scale header warns against. We **recede the
chrome** (the surface that's not in use steps back), which is cleaner, dignified, and
robust to embedding. The dialogue/challenge become the *whole* surface, exactly as
the menu already does.

### 4.4 The z-scale slots (additive, no renumber)

The chrome states are about *visibility*, but the static z-order is simplified by the
consolidation (title + coins retired → fewer slots competing):

```
--wp-z-vignette: 5
--wp-z-overlay:  10
--wp-z-status:   12   /* LEFT capsule (was --wp-z-tracker; same slot) */
--wp-z-placetag: 11   /* RIGHT place tag (was --wp-z-hud; reuse) */
--wp-z-status-detail: 13 /* the expanded card — just above the capsule, below prompt */
--wp-z-prompt:   15
--wp-z-talk:     16
--wp-z-pack:     38   /* pack button (was --wp-z-menu-button) */
--wp-z-dialogue: 40   /* dialogue covers the (now-hidden) chrome anyway */
--wp-z-challenge:60
--wp-z-menu:     70
--wp-z-confirm:  80
```

The pack button's z stays 38 (under dialogue) as a *belt-and-suspenders* backstop,
but it is now **also hidden** by the state machine in `dialogue`/`challenge` — so the
old "z=38 under dialogue=40 but still visible beside the window" overlap is gone
because the button is no longer painted at all in those states.

---

## 5. Premium aesthetic

- **Warm Antigua palette, paper-cutout language**, on-brand with the existing
  `.wp-tracker`/`.wp-menu` (`#f7efe0`/`#efe3cd` paper, `#c46b4a` terracotta accent,
  soft embossed `inset 0 1px 0 rgba(255,255,255,.6)` + `0 4px 14px rgba(58,47,37,.2)`
  shadows). The capsule reads as a **traveler's field card** — a clipped paper note;
  the Place Tag as a small **luggage tag** (a quieter, lower-contrast paper chip).
- **Scene-accent-driven:** both anchors take `--wp-status-accent` / `--wp-placetag-
  accent` from `scene.palette.accent` (as `.wp-tracker` already does), so chrome
  recolors when the Scene flips (Antigua terracotta → Tokyo neon). The flag-pair
  lozenge tints to the accent; the immersion pip uses a calm desaturated accent.
- **Understated, elegant — no Duolingo:** no streak counter, no countdown, no red
  urgency, no number that screams. The wealth/badge whispers are *calm informative*
  glances (a single icon + small total), never a pulsing reward bait. The only
  ambient motion is the existing single objective pulse dot.
- **Localized (~50 langs, immersion-aware):** every string in the chrome flows
  through the established `Partial<XStrings>` override pattern (as `questTracker.ts`
  already does with `QuestTrackerStrings`). The **immersion resolver selects the
  locale**: `uiLocale()` decides whether the capsule's `strings`, the quest
  `step.label`, the item names, the place/era, and the lore render in `native` or
  `target` (`IMMERSION_TOGGLE` §2.4/§2.7 — the tracker is explicitly called out there
  as "already externalized every string; immersion just selects which locale"). Under
  immersion `on`, the capsule reads "Pide un café" not "Order a coffee"; the Place
  Tag and flag-pair are language-neutral (flags + place names + numerals stay).
- **Reduced-motion + a11y:** `prefers-reduced-motion` kills all slide/scale (instant
  show/hide); the capsule is keyboard-operable (`role=button`, `aria-expanded`, Enter/
  Space, Esc to collapse), the detail card focus-trapped while pinned, screen-reader
  labels on the flag-pair ("English to Spanish, immersion reveal"), the presence pip
  (`aria-label="3 players nearby"`), and the deep-link buttons. Touch targets ≥44px
  on the tappable capsule + its buttons. `role="status" aria-live="polite"` on the
  objective row is kept (the live "what next" flips are announced).

---

## 6. Integration seams (data getters/hooks; the migration)

Each piece consumes a **cheap glance getter** so the chrome stays modular and the
orchestrator wires it in `game.ts` behind these hooks. None of these load heavy
state (the pack does that on open).

| Piece | Getter / hook it consumes | Owner doc |
|---|---|---|
| Quest objective/hint/progress | `questEngine.currentStep()` / `stepState()` / `state()` / `subscribe()` (today's tracker inputs, unchanged) | — (exists) |
| Track flag-pair + immersion pip | `trackManager.active().state.{native,target}` + `immersionResolver.level()` | `LANGUAGE_PAIR_STATE`, `IMMERSION_TOGGLE` |
| Wealth glance | **`inventory().walletGlance(): { topCurrency: CurrencyId; major: string }`** (NEW thin getter — top-held currency + decomposed abbreviated total; reads `Wallet`, no UI) | `ECONOMY_CURRENCY` |
| Focus badge | **`badgeStore.focusBadge(): { glyph; tier; arc } \| null`** (the badge nearest next tier) | `BADGES_PROGRESSION` §4.5 |
| Presence count | **`net.presenceCount(): number`** (count of remote players in the room; 0 when solo/offline) | `MULTIPLAYER` / `net/netClient` |
| Place + era + lore | `activeScene.setting.{place,era,lore?}` (today's title source; `lore?` is a new optional Scene field) | — (exists) |
| Locale selection | `immersionResolver.uiLocale()` → which `strings`/labels locale the chrome renders | `IMMERSION_TOGGLE` |
| Deep-links | `shell.openSection("wallet"\|"badges"\|"quest")` (the existing `openSection` seam) | — (exists) |
| Chrome visibility | `setChromeState(state)` fed by `focus.onFocusChange` / dialogue `onClose` / challenge `.then` / `shell.onPause/onResume` (all existing edges) | this doc |
| Track switch live-rebind | on `trackManager.switchTo`, the capsule re-reads the new Track's questEngine/inventory/immersion + re-renders (it already subscribes) | `LANGUAGE_PAIR_STATE` §4.3 |

**Modularity rule:** the capsule and tag each take their getters by injection (like
`mountQuestTracker(parent, opts)` does today) — they never reach into globals. When a
glance getter's backing system isn't built yet, the getter returns `null`/absent and
the row simply **omits** (graceful: no wallet glance before economy lands; no badge
chip before badges land; no presence pip when solo). So the chrome ships
incrementally as each system arrives.

**Migration from today's 3 elements:**
- `.wp-title` (center) → **retired**; its place/era data moves to the RIGHT
  `.wp-placetag` (demoted) and the capsule's expanded lore row. Remove the `title`
  element + `title.textContent` updates in `game.ts` (incl. the `rebuildSceneVisuals`
  line and `sceneSwitcher` toast); the Place Tag re-renders on scene flip via its own
  `setScene(next.setting)` hook.
- `.wp-coinhud` (top-right `🪙 N ✨ N`) → **retired**; the coins move to the pack's
  Wallet, the XP integer becomes the focus-badge glance inside the capsule's expanded
  card. Remove `coinHud` + `renderCoinHud` + `unsubHud` from `game.ts`.
- `.wp-tracker` (top-left) → **evolves** into `.wp-status` (the LEFT capsule):
  `mountQuestTracker` gains the flag-pair/immersion/glance/expand options (additive
  to `QuestTrackerOptions`); its existing render path + subscriptions are reused. The
  rename can be staged (keep `mountQuestTracker`, extend `QuestTrackerOptions` with
  `{ trackInfo?, walletGlance?, focusBadge?, presence?, onExpand? }`, all optional).
- `.wp-hint` (bottom-center) → **demoted** to first-run coaching (§2.6).

This keeps every diff additive behind the new optional opts, and the orchestrator
(`game.ts`, single-owner per the ROADMAP) wires the getters as each system lands.

---

## 7. Phased build plan

Disjoint where possible; `game.ts` + `styles.css` are orchestrator-owned (additive
diffs behind the new getters). Each phase ships independently and degrades (missing
getters → omitted rows).

### Phase H0 — Consolidate to two anchors + the visibility state machine (NO new systems)
**The owner's MVP: "just a left and right thing," responsive, hide-during-dialogue.**
- Retire `.wp-title` (center) + `.wp-coinhud` (top-right) from `game.ts`/`styles.css`.
- Introduce the RIGHT **`.wp-placetag`** (demoted place · era + a presence-pip
  *placeholder* that's hidden until §H2 wires `presenceCount`).
- Evolve `.wp-tracker` → LEFT **`.wp-status`** capsule (flag-pair prefix from the
  Track if present, else hidden; objective/hint/progress as today). No expand yet —
  just the consolidated glance.
- Implement **`setChromeState`** + route the five existing edges (focus / dialogue
  open+close / challenge / menu) into it; **hide top band + pack during
  dialogue/challenge/menu**. Generalize `shell`'s `menuButton.hide()` to the whole
  band.
- Full **responsive matrix** (§2.3) + safe-area + reduced-motion + a11y.
- **Exit (verify in the REAL embedded Corpán app, phone+tablet+desktop):** only a
  left capsule + right tag up top; center empty; opening an NPC window or a challenge
  **hides** the top band AND the pack button (the overlap bug is gone); closing
  returns them; no `.wp-title`/`.wp-coinhud` anywhere.

### Phase H1 — The expandable detail card (idea B)
- Add the **expand** affordance to `.wp-status`: tap/Enter/hover-peek → the in-overlay
  detail card (`.wp-status-detail`) with quest detail (step list + progress bar) and
  the **location/era lore** row. Deep-link `▸ Open quest` → `shell.openSection("quest")`.
- Wealth/badge rows render as **placeholders that omit** until their getters exist.
- Compositor-only animation; Esc/scrim/✕ collapse; focus-trap when pinned.
- **Exit:** tapping the capsule reveals quest detail + era lore in-overlay (never
  body), dignified animation, collapses cleanly; phone-landscape uses the height-
  capped popover; desktop hover-peek works.

### Phase H2 — Glance integrations (as economy/badges/presence land)
- Wire **`inventory().walletGlance()`** → the wealth row + `▸ Wallet` deep-link
  (lands with `ECONOMY_CURRENCY` E0).
- Wire **`badgeStore.focusBadge()`** → the focus-badge row + `▸ Badges` deep-link
  (lands with `BADGES_PROGRESSION` B0; this is the formal replacement of the old `✨`
  integer per that doc §4.5).
- Wire **`net.presenceCount()`** → the RIGHT tag's presence pip (`MULTIPLAYER`).
- Wire **immersion pip** + locale selection (`immersionResolver`) so the whole
  capsule renders in the resolver-selected locale and shows the immersion state.
- Wire **Track flag-pair + live re-render on `switchTo`** (`LANGUAGE_PAIR_STATE`).
- **Exit:** the capsule shows a wealth whisper + focus-badge glance + flag-pair +
  immersion pip; the tag shows presence; each glance deep-links into the pack;
  switching Tracks live-updates the capsule; immersion `on` renders the chrome in the
  target language. All getters optional → any subset can ship before the others.

---

## 8. Open questions for the owner

1. **Center title fully gone?** This doc retires the centered `.wp-title` entirely
   (place moves to the demoted RIGHT tag + capsule lore). Confirm no permanent
   center element is wanted (the center becomes the toast/level-up bloom zone).
2. **Place Tag content:** place **+** era (`Antigua · 1770`) vs place only (era only
   in the expanded lore)? Recommend place·era on tablet/desktop, **place-icon-only**
   on phone-portrait (era always in the expanded lore).
3. **Wealth glance form:** top-held currency icon + abbreviated total (recommended,
   one whisper) vs a tiny multi-currency strip vs nothing-up-top-at-all (purely in
   the pack)? Recommend the single whisper inside the *expanded* card only (collapsed
   stays quest-only).
4. **Desktop hover-peek:** auto-expand the capsule on hover (recommended for fine
   pointers) vs require a click everywhere (more consistent, less magical)?
5. **Track flag-pair in the collapsed glance** vs only in the expanded card?
   Recommend a small flag-pair lozenge collapsed (it answers "which language am I in"
   at a glance — newly meaningful per the Track spine), immersion pip on it.
6. **`focused` state pack-dim:** dim the pack to ~0.4 while an NPC is focused (Talk
   button showing) so it's clearly secondary (recommended), or keep it full until the
   dialogue actually opens?
