# Corpan City — Polish / QA Audit

> Owner: **polish-qa** (the proactive UX-detail sweep). This is the standing
> catalog so the project owner stops being the QA, finding bugs one at a time.
> Re-sweep as the UI grows. Each finding: `file:line` · issue · fix · severity ·
> **owner** (who should land it).
>
> Severity: **P0** = the owner already flagged it / tone-vs-state wrong;
> **P1** = visible emoji where the pack mandates procedural icons; **P2** =
> copy / alignment / consistency polish; **P3** = comments / dev-only / nits.

Design standards enforced (from `docs/FAB_POLISH.md`, `docs/GAME_DEV_PLAYBOOK.md`,
the memory): **NO EMOJI** in shipped UI — everything is the procedural
`iconRenderer` (`src/items/itemArt.ts`) or inline SVG; **tone tiers with score**
(never congratulate a 0%); **copy correctness** ("phrase" vs "word"); premium,
dignified, fixed-size, no dark patterns.

---

## DONE — fixed by polish-qa (presentational, verified)

### #63 — Challenge result card: emoji + inverted tone (the owner's exact bug)
**Was:** `src/challenges/overlay.ts` `showReward()` showed a celebratory burst
glyph for ALL scores — `score>=0.85 ? 🌟 : score>=0.5 ? ✨ : 💪` — so a **0%
showed a bicep-flex 💪**, on a warm-gold celebratory gradient, with a green score
and confetti at any `score>=0.5`. Plus emoji rows (`⭐ XP`, `🪙 Coins`, `🎁/📦`).

**Fix (`overlay.ts` + new `src/challenges/resultArt.ts` + `challenge.css`):**
a score-tiered **mood system** (`moodForScore`) — `fail / low / mid / high /
perfect` — drives the crest, headline, palette, amount-ink and confetti TOGETHER:
- **0% fail** → neutral slate paper, a quiet procedural **retry-loop** crest
  (not an X, never a flex), "Not this time", muted ink, **no confetti**.
- **<0.5 low** → calm warm-neutral, a centered ring crest, "Keep at it", no confetti.
- **0.5–0.75 mid** → warm tan, a checkmark crest, "Well done!", no confetti.
- **≥0.75 high / ≥0.92 perfect** → gold, a radiant **star** crest (+rays at
  perfect), "Great work!" / "Magnificent!", **confetti only here**.

All glyphs are now procedural: the crest is canvas-painted in the shared paper
language; XP/Coins/item rows use `iconRenderer` specs (`renderXpIcon` medal,
`renderCoinIcon` coin-round, `renderItemIcon` token/gem). Close `✕`, the
feedback `✓/✗` splash, the streak `🔥` chip, and the `🧑` avatar fallback are now
inline SVG marks / a neutral procedural bust.

**Verified:** WebKit screenshots at 0 / 0.4 / 0.6 / 1.0 — `/tmp/wp-result-*.png`
(harness: `result-harness.html` + `src/challenges/resultHarness.ts`, driver:
`src/challenges/shotResult.mjs`, `DONE-CLEAN`, 8/8 challenge tests pass).

**Hand-off to i18n (#56 lane):** the five tier headlines are an English source
map `RESULT_TITLE` in `overlay.ts` keyed `result.fail|low|mid|high|perfect` (+
`Score`, `XP`, `Coins`, `Claim reward`). Route them through `t()` when keyed.

---

## P1 — Emoji-as-item-icon (HAND TO ECONOMY: the pack MANDATES `iconRenderer`)

### shop.ts — `ART_GLYPH` is a 30-entry emoji table standing in for item icons
`src/economy/shop.ts:51-66` — items render `🪙 ✉️ 📜 👓 🗝️ 📕 🌿 🧵 🏺 💎 🕯️ 👝
🛍️ 🍞 ☕ 🧺 🧴 🗺️ 🧿 👒 🎩 👕 👚 🧥 👞 🎒 🧣 🖋️ 👓 ✨ 🌼` and kind-fallbacks
`🎽 🍽️ 🔑 📦`; merchant avatars `🧺 🧵 ☕ 🎒` (`:394-412`); wallet coin `🪙`
(`:153,205,236,242,253,260`); merchant avatar fallback `🧑‍🌾` (`:145`); close `✕`
(`:158`). **Fix:** map each `art` id → an `IconSpec` family (token/letter/scroll/
garment/foodstuff/vessel/tool/key/charm/cloth already exist in `IconFamily`) and
render via `iconRenderer().renderIcon(spec,{size})`, exactly like `economyHud`'s
wallet chip does. Close `✕` → inline SVG. **Owner: economy.** **Sev: P1** (this is
the single largest emoji surface and a direct mandate violation).

### currencies / rewardReveal — only comments now (OK), but verify call sites
`src/economy/currencies.ts:12`, `rewardReveal.css:2` reference `+N🪙` only in
**comments** describing what they replaced — no runtime emoji. No action.

---

## P1 — Emoji in challenge tool labels (HAND TO i18n: these are UI strings)

These are localizable strings — they belong to the i18n slice (the `t()`
catalog), not inline. Replace the emoji with the procedural icon or drop it.

- `src/challenges/tools/strings.ts:75,83,108,110,111,113` — EN fallback strings
  carry `🔊 Hear it`, `🧺 {label}`, `🔊 Which one…`, `✓ True`, `✗ False`,
  `🔊 Tap the number…`. Mirror in `src/i18n/strings.ts:279,286,305,307,308,…`
  (the keyed locale values). **Fix:** strip the emoji from the string; render a
  small SVG speaker / check / cross beside the text in the tool, or use an
  `iconRenderer` glyph. **Owner: i18n + quest-flow.**
- `src/challenges/tools/gridTools.ts:31-…` — `PICTURE_GLYPH` is a ~40-entry emoji
  table (`bread:🍞 coffee:☕ apple:🍎 …`) used as the **picture-match stimulus**.
  This is the picture-match game's art; needs a real procedural/illustrated icon
  set, NOT emoji. **Owner: quest-flow/content.** **Sev: P1** (it's the literal
  game content a learner sees).
- Feedback splashes the tools pass as `label`: `✓`, `✗`, `🔥 x{streak}`, `🔊`,
  `🎤` across `sttTools.ts:59,80,115,121`, `choiceTools.ts:110,267,294`,
  `textTools.ts:120,212,283,328-331`. The overlay's `feedback()` now draws SVG
  when **no** label is passed — so **the cleanest fix is for the tools to stop
  passing the emoji label** and let the overlay draw the mark (combo count can be
  a plain `x{n}` string). `textTools.ts:328-331` also uses `🧑‍🍳`/`🙂` as dialogue
  avatars. **Owner: quest-flow.** **Sev: P1.**
- `src/challenges/registry.ts:135` — default NPC avatar `🧑` when none supplied.
  **Fix:** pass `""` so the overlay draws its neutral procedural bust (already
  built). **Owner: quest-flow.** **Sev: P2.**

---

## P1 — Emoji elsewhere in chrome (mixed owners)

- `src/quest/questTracker.ts:106-108` — `LANG_FLAG` map = 50+ flag emoji
  (`🇬🇧🇪🇸🇫🇷…`) for the track lozenge; wallet bridge `setIcon("💵")` (`:528`),
  badge bridge `setIcon("🏅")` (`:539`), close `✕` (`:236`). FAB_POLISH §1.1
  explicitly bans these. **Fix:** flag-pair as a small SVG/text pair or an
  `iconRenderer` glyph; wallet/badge already have `IconSpec`s available from the
  glance. **Owner: shell/HUD (TOP_HUD).** **Sev: P1.**
- `src/world/npcFocus.ts:49,55` — the floating talk prompt is `💬` and the Talk
  button is `<span>💬</span> Talk`. **Fix:** inline SVG speech mark (the
  `iconRenderer` has a `speech` emblem). **Owner: world/shell.** **Sev: P1**
  (it floats over every NPC — high visibility).
- `src/shell/placeTag.ts` — already fixed to SVG pin per FAB_POLISH (`:94`
  comment); only the `📍` in a comment/header (`:11,94`) remains. No action.
- `src/shell/menuPanel.ts:240`, `src/map/fullMap.ts:610`,
  `src/economy/market/marketFloor.ts:134` — close buttons render `✕` text. **Fix:**
  inline SVG close (same mark `overlay.ts` now uses — consider factoring a shared
  `closeButton()` into `packs/shared/ui`). **Owner: shell.** **Sev: P2.**
- `src/npc/npcRuntime.ts:78,79,675,708,710,850` — note/label strings:
  `🎮 Play`, `Nicely done! 🎉`, `✓ {step}`, `🤝 Hand over {item}`,
  `🎁 Received the {item}!`. `src/npc/dialogueUI.ts:37,127` — `🎮 Play`, close `✕`.
  These are user-facing NPC UI strings. **Fix:** SVG/icon + localize. **Owner:
  npc + i18n.** **Sev: P1.**
- `src/economy/economyHud.ts` — clean (uses `iconRenderer`); the `🪙` at `:16,68`
  are comments. No action.
- `src/vignettes/taxi.ts:232` — taxi NPC avatar `🚕`. `src/vignettes/questInterlude.ts`
  uses `★` (typographic, acceptable). **Owner: vignettes.** **Sev: P2** (`🚕`).
- `src/entry/surfaces.ts:101,159,175,187` — entry/welcome card stamps
  `✦ ☼ ☻ ✎`. These are **typographic dingbats**, not color emoji — borderline,
  but `☻ ✎` can render as emoji on some platforms. **Fix (optional):** swap to a
  small SVG seal for consistency. **Owner: entry.** **Sev: P3.**
- `src/world/buildings.ts:672-685` — building roof signs `✚ 🛏 ☕ ⚒`. These are
  3D-world signage glyphs (drawn on a cutout), low-res at distance; `🛏 ☕` are
  emoji. **Fix:** procedural sign motifs. **Owner: world.** **Sev: P2.**
- `src/game.ts:842,858,889,898` — toast `✓ {label}`, comment `🎁`, NPC avatar
  `🧑` default (pass `""`), comment `+🪙`. **Owner: lead/game.** **Sev: P2.**

---

## P2 — Map marker glyphs (mostly OK; two true emoji)

`src/map/mapCore.ts:226-244` `MARKER_STYLES` pairs a **procedural `shape`** with a
text `glyph`. Most glyphs are typographic symbols over the shape (`★ ✦ ⌂ ≈ ¤ • ?
$ ✕`) and read fine. **Two are color emoji:** `docks: ⚓` (`:236`) and the ferry
`⛴️` referenced in tools. **Fix:** drop the emoji glyph (the teal pin shape
already carries the meaning) or draw a tiny anchor in the marker painter
(`map/schematic.ts:207-215`). **Owner: map.** **Sev: P2.**

---

## Notes / non-issues

- `★ ✦ ☼ ¤ ≈ ⌂ • ? $` are monochrome typographic symbols, not emoji — they honor
  the "no emoji" rule's intent (no multicolor clip-art). Flagged only where they
  may font-fallback to emoji (`☻ ✎ 🛏 ☕ ⚓ ⛴️`).
- Comments mentioning emoji (`+N🪙`, "replaces the ✨ integer", etc.) are history,
  not UI — left as-is.
- The `feedback()` SVG-when-no-label path is now in place, so the tools can drop
  their emoji labels with **zero overlay changes** — the cheapest fix for the
  largest P1 cluster (challenge tool splashes).

## Tooling left for re-sweeps
- `result-harness.html` + `src/challenges/resultHarness.ts` + `shotResult.mjs`:
  `npm run dev` then `node src/challenges/shotResult.mjs` → tiered result-card
  screenshots in `/tmp/wp-result-*.png`.
- Emoji grep: `grep -rnP '[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]'
  --include='*.ts' --include='*.css' --include='*.json' src | grep -v test`.
