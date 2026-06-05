# World Plaza — Per-Track Total Immersion Toggle

**Status:** Design + plan. NO code in this doc — it is the spec the implementation
fans out from. Builds on the **Track** spine (`docs/NEXT_LEVEL_PLAN.md` §"the
per-pair Track") and the cohesion surfaces (`docs/COHESION_ITERATION.md`,
esp. §3 tracker, §6/§7 prompt). Depends on (and composes over)
`docs/LOCALIZATION_SCALE.md` (being written in parallel) — see §3.4.

**Author intent in one line:** a **per-Track** setting that controls *how much of
the learner's native (English) language appears on screen*. The SAME user runs
immersion **ON** for a target they are already strong in (`en→es` → target-only,
no English anywhere) and **OFF** for a hard target (`en→ar` → keep every gloss and
translation). It is a **presentation layer**, never a content gate.

The guiding principle: **one `immersion` value on the Track + one pure resolver
every surface consults.** No surface decides immersion locally; nothing leaks
native text when ON because every native-bearing render goes through the resolver.

---

## 0. Why this is a real feature, not a flag

Three facts from the current code make this both necessary and clean:

1. **Native text is sprinkled across many surfaces**, each deciding for itself
   today: the LLM prompt allows "one tiny `(native)` gloss"
   (`promptProgram.ts` lines 346, 421); `entryPair` returns a `native` string
   that bilingual challenges (`fast-translate`, `tap-translation`, `true-false`
   in `choiceTools.ts`) render as the *answer*; the tracker/menu/HUD copy is in
   the learner's native UI language. Without a single seam, an "immersion" toggle
   would be a dozen scattered `if`s that inevitably leak.
2. **The single-language-stack path already proves the mechanism.** When
   `learnerPair.target === native` (or `nativeLanguage` is absent), `entryPair`
   *already* collapses native→target (`host.ts` "single-language stack →
   immersion"), and `composeSystemPrompt` *already* switches to the immersion
   discipline ("Reply in {target} ONLY — immersion; rephrase, don't translate.").
   **Immersion ON is exactly "make this two-language Track behave like a
   one-language stack for presentation"** — we are generalizing an existing,
   tested code path, not inventing one.
3. **It must be per-Track.** A user with `en→es` (strong) and `en→ar` (new) needs
   opposite settings simultaneously. So the flag lives on Track state, namespaced
   by the pair key, exactly like character/inventory/XP/quests.

---

## 1. Immersion levels (three, not two)

A single enum on the Track. Two endpoints + one middle tier that makes immersion
*adoptable* (the safety net, §6, is what lets a learner dare to turn it up).

```
type Immersion = "off" | "reveal" | "on"
```

| Level | One-line meaning | When the user picks it |
|-------|------------------|------------------------|
| **`off`** | **Native help everywhere.** Glosses, bilingual challenge answers, native UI copy, the LLM's `(native)` parenthetical — all present. | Brand-new / hard target (`en→ar`). **Default for a new Track.** |
| **`reveal`** | **Target-first, native on demand.** Screen shows target only; every native string is *available* behind a tap/long-press "reveal" but hidden by default. The LLM gives target-only prose (no auto gloss). | The growth tier — "I want immersion but a safety net." Suggested when the user is doing well (§5). |
| **`on`** | **Total immersion — NO native anywhere, automatically.** No glosses, no bilingual challenge mode, target-only LLM, target-rendered UI. The reveal affordance (§6) still exists as a deliberate escape hatch, but nothing native is *shown* unprompted. | A target the user is strong in (`en→es`). |

The difference between `reveal` and `on` is **only whether the on-demand reveal
affordance is offered proactively vs. tucked away** — both hide native by default.
This keeps the resolver simple: `reveal` and `on` share the "hide native" branch;
they differ in one boolean (`offerReveal`). See §3.

> **Single-language stack interaction:** a one-language Track (`target === native`,
> the SINGLE_LANGUAGE_RULE immersion case) is *inherently* `on` and the toggle is
> **hidden** (there is no native to show). The resolver treats `target === native`
> as `on` regardless of the stored value, so the rule is honored for free.

---

## 2. Per-surface ON/OFF/REVEAL matrix (the full audit)

Every place native (English) text can appear today, with the exact behavior at
each level and **how it is driven** (always: *the surface asks the resolver,
§3*). "native-bearing" = the surface can emit `native` text.

### 2.1 NPC dialogue — parenthetical gloss (`src/npc/promptProgram.ts`, rendered by `dialogueUI.ts`)
The gloss is produced by the **model**, instructed by the language-discipline
line. There is no separate "gloss element" to hide — so immersion is enforced **in
the prompt**, by changing the instruction (§4). `dialogueUI` itself renders
whatever prose arrives; it does not need a code change for dialogue gloss (it does
for chips/subtitle — see 2.6).

| Level | Behavior | Driven by |
|-------|----------|-----------|
| `off` | Prompt keeps *"one tiny `(native)` gloss in parentheses allowed for a new word"* (today's line 346/421). Model may add an English gloss. | `composeSystemPrompt` reads `immersion` (§4). |
| `reveal` / `on` | Prompt forbids ALL native, even the gloss: *"Reply in {target} ONLY. Do NOT translate or add any {native} gloss; rephrase in {target} if a word is hard."* (This is essentially today's single-language-stack line, applied to a 2-lang Track.) | same |

> **`reveal` extra:** the *individual words* in an NPC line can still be revealed
> on demand (§6, long-press a word → host-translate to native), but the model
> never volunteers native. So `reveal` and `on` send the **identical** prompt; the
> difference is purely the UI affordance.

### 2.2 Challenge prompts / answers / hints (`src/challenges/tools/*`, via `entryPair`)
The deepest surface. Bilingual challenges (`fast-translate`, `tap-translation`,
`true-false`, `match`/grid pairs) show the `native` string as the prompt or the
answer options. **Hiding native here is not "blank the string" — it would break the
game** (a translate game with the answer hidden is unplayable). Instead:

| Level | Behavior | Driven by |
|-------|----------|-----------|
| `off` | `ChallengeContext.nativeLanguage = learnerPair.native`. `entryPair` returns real native; translate/match games run target↔native as today. | `game.ts` sets `nativeLanguage` from the resolver when building `ChallengeContext` (line ~247). |
| `reveal` / `on` | `ChallengeContext.nativeLanguage = undefined`. `entryPair` **already collapses native→target** (the single-language path). The tool's `buildSpec` then sees a one-language context and must present a **target-only variant** of the round: definition/synonym match, target-word ↔ romanization, target audio ↔ target word, cloze/typo in target — NEVER target↔English. | resolver → `game.ts` omits `nativeLanguage`; tools branch on "no native". |

**Concrete per-tool immersion variant (the localization+content workstreams own
the round data; this doc fixes the contract):**
- `fast-translate` / `tap-translation` (target↔native) → under immersion become
  **`tap-definition`**: prompt = target word, options = short *target-language*
  definitions/synonyms (or images where the corpus has them). If no target
  definition exists for an entry, fall back to **target word ↔ romanization** (CJK)
  or skip that entry — never show English.
- `true-false` ("does this translation match?") → **"does this target paraphrase
  match?"** (target sentence vs. target paraphrase), or audio↔text true/false.
- `odd-one-out`, `which-heard`, number/grid tools → already mostly target-side;
  ensure their `promptSub`/labels come from the localized `strings` (2.7), not
  hard English.
- `cloze` / `typo` / fill-blank → already target-only; no change beyond UI copy.

A challenge tool advertises whether it **has** an immersion-clean variant via a
small capability flag (`supportsImmersion: boolean` on the registered tool, §3.3).
When immersion is `on`/`reveal` and a queued tool lacks the variant, the
**offer resolver prefers an immersion-capable tool** (the persona∩quest whitelist
already lets us pick), so we never spring an English-required game in immersion.

> **`reveal` nuance for challenges:** the round itself is target-only, but a small
> "reveal meaning" affordance on the prompt word (§6) lets a stuck learner peek the
> native gloss without changing the round's answer space. `on` keeps the affordance
> present-but-quiet; identical round data.

### 2.3 The challenge "pretext"/segue line (`OverlayPretext.line`, `challengeSegues.ts`, `resolveGameOffer.segue`)
Already **target-language by design** (the doc comment in `promptProgram.ts`
explicitly says the old English pretext was the bug they killed; `segue` is
target). So this surface is **immersion-safe at all levels already** — verify no
English `line` is ever passed. The `challengeLabel`/`playOffer` chrome strings are
UI copy (2.7).

### 2.4 The quest tracker (`src/quest/questTracker.ts`)
The objective/hint lines mix **authored step labels** (`step.label`), **item
names** (`getItemDef().name`), **anchor/NPC names**, and **UI templates**
(`findItem`/`deliverItem`/`talkTo`/`progress`). At `off` these are the native-UI
copy; at `on` they must be **target-language**.

| Level | Behavior | Driven by |
|-------|----------|-----------|
| `off` | Today's behavior: `strings` are the learner's native-UI copy; `step.label`/item names shown in native authored form. | Caller passes native-UI `strings`; resolver = passthrough. |
| `reveal` / `on` | `strings` come from the **target-language** locale pack; `step.label` and item names resolve to their **target** rendition (authored quests carry localized labels per `LOCALIZATION_SCALE.md`; item defs gain a target `name`). The tracker shows e.g. "Pide un café" not "Order a coffee". | `mountQuestTracker` receives `strings` + label/name resolvers chosen by the resolver (§3). The tracker itself is unchanged — it already takes injectable `strings` + `itemLabel`/`anchorName` resolvers. |

This is the cleanest possible: **the tracker already externalized every string**
(`QuestTrackerStrings`, `anchorName`, `itemLabel`). Immersion just selects *which*
locale of those resolvers to hand it. The `reveal` tier adds: tapping the tracker
to reveal the native gloss of the current objective (it already opens the menu
Quest section — that section can show native-on-demand, §2.5).

### 2.5 Menu / shell (`src/shell/menuPanel.ts`, `menuButton.ts`, `confirm.ts`)
Tabs (`Map`/`Inventory`/`Quest`), titles, Resume/Leave buttons, the exit confirm.

| Level | Behavior | Driven by |
|-------|----------|-----------|
| `off` | `MenuStrings` = native-UI locale. | Caller passes native `strings`. |
| `reveal` / `on` | `MenuStrings` = **target-language** locale (tabs "Mapa/Inventario/Misión", "Reanudar", "Salir de la plaza"). | Resolver selects the target locale for the menu's `strings`. |

**Exception (dignity + safety):** the **destructive "Leave the Plaza" confirm**
keeps a *native* affordance even under immersion `on` — a learner must never be
unable to read "are you sure you want to quit?". Pattern: confirm shows target as
primary with the native as a smaller secondary line (always), OR the confirm is one
of the few surfaces the resolver flags `keepNative: true`. Premium > purist.

### 2.6 NPC dialogue chrome (`dialogueUI.ts` strings + subtitle + chips)
`DialogueUIStrings` (`inputPlaceholder`, `close`, `replay`, `voiceComingSoon`,
`challengeLabel`, `playOffer`), the NPC `subtitle`, and the suggested-reply
**chips**.
- **Strings/subtitle:** UI copy → target locale at `on`/`reveal`, native at `off`
  (2.7 mechanism).
- **Suggested-reply chips** (`setChips`): these are *things the learner could say*.
  At `off` they may be native ("Ask for the bill"); at `on`/`reveal` they MUST be
  **target-language utterances** the learner taps to send. (If chips are generated,
  generate them in target; if authored, author target variants.) This is a content
  surface — flagged for the localization workstream.

### 2.7 The UI-copy mechanism (HUD, badges, economy, empty/error, onboarding)
Every UI string in the pack already flows through a per-surface `strings` override
object (`DEFAULT_STRINGS` + caller overrides — the established pattern in
`dialogueUI`, `questTracker`, `menuPanel`). Immersion does **not** invent a new
i18n path; it **chooses which locale** of the existing `strings` the orchestrator
passes:
- `off` → strings in **`native`** (the learner's UI language).
- `reveal` / `on` → strings in **`target`**.

So **HUD** (coins/XP labels), **badges** (badge names/categories — future
`BADGES_PROGRESSION`), **economy/market** copy (future `ECONOMY_CURRENCY`),
**error/empty states**, and **the level-complete / quest-intro cards** all become
immersion-correct *for free* the day they route their `strings` through the
resolver-selected locale. **New surfaces inherit immersion automatically** by
following the rule in §3.5.

**Onboarding is the one deliberate exception:** onboarding (target picker, the
"how strong are you?" prompt that *sets* the default immersion) is **always in the
user's native/primary language** — you cannot localize the question that decides
localization. Immersion begins to apply only *after* a Track is entered. (This
mirrors the app's primary-language-FIRST onboarding principle.)

### 2.8 Numbers/glyphs/names that are never "native"
Coin counts, XP numbers, item *glyphs* (`ART_GLYPH`), proper place/era names from
the Scene, emoji — these are language-neutral and **unchanged** at every level.
Romanization is **target-side help, not native** → it stays at all levels (it
*aids* immersion, it isn't English).

---

## 3. The seam: one setting + one resolver

### 3.1 The setting lives on the Track
Per `NEXT_LEVEL_PLAN`, the Track (`(native, target)`) already owns
character/inventory/XP/quests/**immersion**. Add `immersion: Immersion` to the
per-Track state, namespaced by the pair key, persisted with the rest of Track
state (IndexedDB / tiny localStorage — it is a single enum, <1 byte of pressure).
Default `"off"` for a new Track (§5). The **`LANGUAGE_PAIR_STATE` workstream owns
the storage shape**; this doc owns the value's meaning + how every surface reads it.

### 3.2 The resolver (`src/immersion/immersion.ts`, NEW — pure, no DOM)
A single pure module every surface consults. It NEVER touches the DOM; it returns
*decisions* the orchestrator/surface applies.

```
type Immersion = "off" | "reveal" | "on"

interface ImmersionResolver {
  level(): Immersion                         // the Track's setting (on if target===native)
  hideNative(): boolean                      // true for "reveal" | "on"
  offerReveal(): boolean                     // true for "reveal" | "on" (the §6 affordance)
  proactiveReveal(): boolean                 // true ONLY for "reveal" (hint the affordance)

  // Which locale a surface's UI `strings` should be rendered in:
  uiLocale(): LanguageCode                   // hideNative() ? target : native

  // The native code to pass into ChallengeContext (undefined hides native →
  // entryPair collapses to target-only, the proven single-language path):
  challengeNativeLanguage(): LanguageCode | undefined   // hideNative() ? undefined : native

  // Prompt discipline string fragment for composeSystemPrompt (§4):
  languageDiscipline(target: string, native: string): string

  // Per-surface escape hatch (the Leave-confirm keeps native, 2.5):
  resolveStrings<T>(native: T, target: T, opts?: { keepNative?: boolean }): T
}

function createImmersionResolver(args: {
  level: Immersion
  learnerPair: LearnerPair       // to detect target===native → forced "on"
}): ImmersionResolver
```

**Composition rules (the whole behavior, centralized):**
- `hideNative = level !== "off"` (and `true` when `target === native`).
- `uiLocale = hideNative ? target : native`.
- `challengeNativeLanguage = hideNative ? undefined : native`.
- `offerReveal = hideNative` (reveal hatch exists whenever native is hidden).
- `proactiveReveal = level === "reveal"` (only this tier nudges the hatch).

Every native-bearing surface in §2 calls exactly ONE of these. Adding a surface =
"route its strings through `uiLocale()` / `resolveStrings`, and if it shows corpus
glosses, use `challengeNativeLanguage()`." Nothing else can leak.

### 3.3 Challenge-tool capability flag
Add `supportsImmersion?: boolean` to the registered `ChallengeTool` (registry
metadata, not the wire `ChallengeSpec`). The offer resolver
(`offerableTools`/`resolveGameOffer`) filters to immersion-capable tools when
`resolver.hideNative()`. Bilingual-only tools without a target-only variant are
simply not offered under immersion — never sprung and then broken.

#### 3.3.1 Cross-language game exception (IMPLEMENTED, #27 — owned by the challenge layer)
A **cross-language** game (translate / tap-the-meaning / match-pairs) shows the
prompt in one language and the answer in the OTHER. Under immersion the resolver's
`challengeNativeLanguage()` returns `undefined` (drop native → target-only), which
for these games would collapse BOTH sides to the target → a tautology ("tap the
word that means 'I see the star'" where the answer is also "I see the star").

The fix lives in the **challenge layer**, NOT the resolver (the cleaner seam — the
per-tool knowledge belongs there): `isCrossLanguageTool()` in
`src/challenges/registry.ts`, and `game.ts` OVERRIDES
`ctx.nativeLanguage = learnerPair.native` for those tools when `native ≠ target`,
even under immersion. The resolver stays pure and unchanged
(`createImmersionResolver` is untouched) — monolingual drills still get
`undefined`. **Rule recorded here:** a cross-language game must never resolve both
prompt and answer to the same locale; one side stays the contrasting language.

> **Single-language stack (`native === target`):** a cross-language game is a
> tautology BY DEFINITION (there's no contrasting language). Such tools are
> filtered out of the offer for 1-lang stacks (challenge-layer offer filter) — a
> stopgap until the full single-language-mode redesign. The owner also floated
> excluding inherently-2-language games for native-only (non-learning) stacks; same
> filter point. The resolver records the rule; the offer layer enforces it.

### 3.4 Composition with the localization seam (the dependency)
**Immersion ≠ localization. Immersion is "how much native to show"; localization
is "render this string in `target` or `native`."** They compose like this:

```
LOCALIZATION_SCALE  provides:  strings/labels available in EVERY language
                               (UI copy, quest labels, item names, challenge content)
        │
        ▼
IMMERSION resolver   decides:  which side (target vs native) each surface uses
        │                      via uiLocale() / challengeNativeLanguage()
        ▼
SURFACE              renders:  the chosen locale's strings
```

- Immersion is **strictly downstream** of localization. If
  `LOCALIZATION_SCALE` has not yet provided a target-language string for a
  surface, immersion `on` **degrades gracefully**: show romanization/target corpus
  where available, else fall back to native for *that one missing string* and log
  noisily (never blank, never crash). The resolver exposes
  `resolveStrings(native, target)` precisely so a `target===undefined` falls back
  to `native` safely.
- This doc declares the **dependency**: full immersion `on` polish requires the
  ~50-language UI/label/content coverage that `LOCALIZATION_SCALE` is building.
  MVP immersion (§7) ships against the languages already covered (the prompt
  discipline + challenge `nativeLanguage` drop work for *all* pairs immediately;
  the UI-copy localization lands per-language as `LOCALIZATION_SCALE` delivers).

### 3.5 The non-negotiable rule for every future surface
> **If a surface can render native text, it MUST get that text via the immersion
> resolver — `uiLocale()` for UI copy, `challengeNativeLanguage()` for corpus
> glosses, `resolveStrings()` for a native/target pair. Never read the raw
> `native` code directly.** A code-review checklist item; a leak = a bug.

---

## 4. LLM prompt impact (`composeSystemPrompt` / `questFactsSection`)

Immersion changes **two lines** of the prompt and nothing else — the prompt stays
≤~200 tokens (it actually gets *shorter* at `on`).

**Today (`promptProgram.ts`):**
- line 346 (normal NPC, 2-lang): *"Reply in {target} ONLY (one tiny ({native})
  gloss in parentheses allowed for a new word)."*
- line 421 (`questFactsSection`, special NPC): *"Speak mostly in {target}; you MAY
  add a short ({native}) gloss in parentheses for one new word."*

**Change:** both lines come from `resolver.languageDiscipline(target, native)`:

| Level | `languageDiscipline(...)` returns |
|-------|-----------------------------------|
| `off` | *"Reply in {target} ONLY (one tiny ({native}) gloss in parentheses allowed for a new word)."* (today's line — unchanged) |
| `reveal` / `on` | *"Reply in {target} ONLY. Do NOT translate or add any {native} text or gloss; if a word is hard, rephrase it in simpler {target}."* |

The special-NPC `questFactsSection` line is the same substitution: at `on`/`reveal`
the *"you MAY add a short ({native}) gloss"* clause is **removed entirely** and
replaced with *"Use {target} only; no {native}."* The authored `authoredClue` /
`authoredNextHint` lines are *re-voiced in {target}* exactly as today — they were
never English-output to begin with (the model translates+flavors them).

**Why it stays tight:** we are swapping one clause for another, not adding a block.
The `on` clause is shorter than the gloss-permission clause. `maxSentences`,
SCAFFOLD_RULES, RAILS, tool protocol — all unchanged. No new token budget.

**Note — this generalizes existing code:** the immersion clause is nearly verbatim
the single-language-stack line already at line 345 (*"Reply in {target} ONLY —
immersion; rephrase, don't translate."*). The `single` branch in
`composeSystemPrompt` becomes `single || resolver.hideNative()` — i.e. a 2-language
immersion Track and a 1-language stack take the **same** discipline branch. (The
existing test `npc.test.ts "single-language stack → immersion discipline"` should
gain a sibling: "immersion ON on a 2-lang Track → same discipline.")

---

## 5. UX — where the toggle lives, defaults, communication

### 5.1 Location
- **Per-Track**, reachable from the **menu** (`menuPanel.ts`). Add a small
  **"Immersion"** control in the menu — most naturally a row at the top of the
  **Quest** section (it is a per-Track learning setting) or a dedicated tiny
  **Settings** affordance in the menu header. A segmented control:
  **`Native help · Reveal · Immersion`** (three dignified segments, not a Duolingo
  pressure dial).
- Also surfaceable from the **track-switcher** (when the user picks/jumps a Track,
  show its immersion state) — owned by `LANGUAGE_PAIR_STATE`, this doc just notes
  the value is shown there.

### 5.2 Communication (premium, dignified)
- A one-line description under the control, localized:
  - `off`: "Show your language alongside {target}."
  - `reveal`: "{target} only — tap any word to reveal its meaning."
  - `on`: "Total immersion. {target} only."
- A short, **optional, non-nagging** suggestion when the user is doing well on a
  Track (high challenge scores / streak of correct answers): a single dismissible
  card — *"You're flying in {target}. Try Reveal mode?"* — never auto-flips,
  never repeats if dismissed (`wp:immersion:suggested:<pairKey>`). No dark
  patterns: it suggests **Reveal** (the safety-netted tier), not raw `on`.

### 5.3 Defaults
- **New / hard Track → `off`.** A brand-new pair always starts with full native
  help. (Onboarding's "how strong are you in {target}?" can pre-seed: "comfortable"
  → default `reveal`; "fluent-ish" → `on`; otherwise `off`.)
- **Single-language stack → forced `on`** (no native exists; control hidden).

### 5.4 Instant effect (no reload) — required
Flipping immersion **re-renders live**, no pack reload:
- UI surfaces (tracker, menu, dialogue chrome, HUD): re-invoke their render with
  the resolver-selected `strings`/locale. They already subscribe/re-render
  (tracker subscribes to engine+inventory; menu re-renders the active section).
  The orchestrator broadcasts an immersion-changed signal (a tiny store
  `subscribe`, mirroring `inventory()`), and each mounted surface re-pulls its
  strings.
- The **LLM prompt** picks up the new discipline on the **next** NPC turn
  automatically (it is composed per-turn) — no mid-stream change needed.
- The **next challenge** picks up `challengeNativeLanguage()` when its
  `ChallengeContext` is built — an in-flight challenge finishes in its current
  mode (don't yank the answer space out from under the player).

#### 5.4.1 IMPLEMENTED — in-place re-localize (no world rebuild)
The first cut wrongly reused the stack-flip world REBUILD on toggle, which reset
the player to the spawn point. Fixed: flipping immersion now applies **in place**.
`game.ts buildWorld` holds a mutable `resolver`/`uiLocale` and a `relocalize(next)`
that: recomputes the resolver, re-applies the RTL `dir` to the pack root + overlay,
and re-localizes the live chrome surfaces — `tracker.relocalize()`,
`placeTag.relocalize()`, `shell.relocalizeMenu()` (which also re-renders the OPEN
menu section). Modal surfaces (quest section, interlude, inventory) read a LIVE
`currentUiLocale()` (the section's `strings` is a getter), so reopening shows the
new locale. The Babylon scene, **player position, camera, NPCs, quest engine, and
inventory are untouched** — only the chrome text + direction flip. Verified
standalone: `?stack=en,es` and `?stack=en,ar` flips keep the player at the same
coordinates; the UI flips to target (and to RTL for `ar`) with the menu still open.

#### 5.4.2 The toggle control itself stays NATIVE (always)
The immersion toggle's own label + On/Off render in the learner's **native**
language regardless of immersion state (`bindT(nativeLocale)`, not `uiLocale`). If
the toggle localized to the target under immersion, a user who flipped ON couldn't
read the control to flip it back OFF. It is the one surface deliberately immune to
immersion — the always-readable escape hatch.

### 5.5 Accessibility
- The segmented control is keyboard-navigable (arrow keys), `role=radiogroup`,
  each segment labeled. Touch targets ≥44px (tablet/desktop/phone all first-class).
- Reveal affordance (§6) is operable by keyboard (focus a word → Enter reveals)
  and screen-reader friendly (`aria-expanded`, the native gloss announced when
  revealed). `prefers-reduced-motion` respected for any reveal animation.

---

## 6. Safety net — on-demand "reveal native" (immersion's escape hatch)

Even at `on`, the learner is **never truly stuck**. A deliberate, low-friction
reveal affordance exists at `reveal` AND `on` (`resolver.offerReveal()`), differing
only in how *visible* the affordance is (`proactiveReveal()` hints it at `reveal`).

**The affordance:** **long-press (touch) / right-click or hover-hold (pointer) /
focus+Enter (keyboard) on a word or line → a small popover shows the native
meaning** (via host translate of the corpus entry, or the authored native gloss
where one exists). It is:
- **Transient** (popover, auto-dismiss) — it does not turn immersion off, does not
  persist English on screen, does not change challenge answer spaces.
- **Per-surface**: works on NPC dialogue words (host-translate the tapped word),
  the tracker objective (reveal the native step label), challenge prompt words
  (peek meaning without altering options).
- **Quiet at `on`** (no visual hint; the user must know the gesture — taught once
  in onboarding/first-immersion), **hinted at `reveal`** (a subtle underline /
  "tap to reveal" microcopy the first few times).

This is the feature that makes immersion *brave-able*: a user will turn it `on`
knowing they can always peek, without the peek breaking immersion.

> **Implementation seam:** a single `src/immersion/reveal.ts` (NEW) attaches the
> gesture + popover to any element given a `revealNative(text|entryId) =>
> Promise<string>` resolver (host translate). Surfaces opt in by wrapping their
> word/line elements; the resolver gates whether it is active/hinted. No surface
> reimplements reveal.

---

## 7. Phased build plan

Disjoint file ownership; the resolver is the keystone shared dependency.

### Phase 0 — The seam (keystone, tiny)
- **`src/immersion/immersion.ts`** (NEW): `Immersion` type + `ImmersionResolver`
  + `createImmersionResolver` (pure, unit-tested — no DOM).
- **Track state:** `immersion: Immersion` field added to per-Track state
  (coordinate with `LANGUAGE_PAIR_STATE`; default `"off"`, forced `"on"` when
  `target===native`). A tiny immersion store with `subscribe` for live re-render.
- **Exit criteria:** resolver unit tests cover the `off/reveal/on` ×
  single-language matrix; `hideNative`/`uiLocale`/`challengeNativeLanguage`
  /`languageDiscipline` all correct.

### Phase 1 — MVP: the three load-bearing surfaces (the owner's named set)
Apply the resolver to **dialogue gloss (prompt) + tracker + challenges** — the
surfaces that most visibly leak native today.
- **Prompt (`promptProgram.ts`):** `languageDiscipline` from the resolver (§4);
  `single || hideNative()` branch; remove the gloss-permission clause in
  `questFactsSection` under immersion. Add the sibling test.
- **Challenges (`game.ts` + tools):** `ChallengeContext.nativeLanguage =
  resolver.challengeNativeLanguage()`; add `supportsImmersion` to the registry +
  offer-filter; ship the **target-only variants** of `fast-translate`/
  `tap-translation`/`true-false` (`tap-definition` etc., §2.2) — coordinate round
  data with `LOCALIZATION_SCALE`/`CONTENT_SCALE`.
- **Tracker (`questTracker.ts`):** orchestrator passes resolver-selected
  `strings` + `itemLabel`/`anchorName` locale; no tracker code change (already
  injectable).
- **Toggle UI:** the segmented control in the menu (§5.1) + live re-render (§5.4).
- **Exit criteria:** on a real `en→es` Track, flipping to `on` → NPC stops glossing
  in English, the translate game becomes a target-definition game, the tracker
  reads in Spanish — all without reload. **Verify in the REAL embedded app**
  (the standalone-vs-embedded trap), phone+tablet+desktop.

### Phase 2 — Full per-surface coverage
- Menu/shell strings (`menuPanel`, `menuButton`, `confirm` with the Leave-confirm
  native exception), dialogue chrome + **target-language suggested chips**, HUD,
  level-complete/quest-intro cards, error/empty states, and the future
  economy/badges UI — all routed through `resolver.uiLocale()` / `resolveStrings`.
- Codify the §3.5 rule as a review checklist.

### Phase 3 — The on-demand reveal (safety net)
- **`src/immersion/reveal.ts`** (NEW): the long-press/right-click/focus popover +
  host-translate resolver, opt-in per surface, gated by `offerReveal()` /
  `proactiveReveal()`. Wire dialogue words, tracker objective, challenge prompt
  words. Teach the gesture once on first immersion.
- This unlocks the `reveal` middle tier fully and makes `on` brave-able.

### Cross-cutting (every phase)
- **Localize every new string** (~50 langs) via the existing `strings` pattern;
  immersion only *selects* the locale (§3.4 dependency on `LOCALIZATION_SCALE`).
- **Graceful degradation:** missing target string → fall back to native for that
  one string + log noisily; never blank, never crash (noisy-errors rule).
- **No `window.confirm/alert`**; the toggle + reveal are in-`.wp-overlay` (the
  embedding-safe surface).
- **Storage:** the setting is one enum per Track (negligible); no 5MB pressure.
- **Premium/dignified:** the suggestion is opt-in and dismissible; no nagging.

---

## 8. Open questions for the owner
1. **Toggle home:** top of the menu **Quest** section vs a dedicated menu
   **Settings** affordance vs the track-switcher (recommend: Quest-section row +
   mirrored in the track-switcher).
2. **Onboarding pre-seed:** should "how strong are you in {target}?" set the
   default immersion (comfortable→`reveal`, fluent→`on`), or always start `off`
   and only *suggest* later? (Recommend pre-seed — it is the natural moment.)
3. **Leave-confirm native exception (§2.5):** keep native always on the destructive
   confirm even at `on`, or trust target-only? (Recommend keep native — dignity.)
4. **`tap-definition` corpus:** do we have target-language definitions/synonyms in
   the corpus for the immersion challenge variant, or do we lean on
   target↔romanization + image rounds until `CONTENT_SCALE` supplies definitions?
   (Determines how rich Phase 1 immersion challenges feel out of the gate.)
