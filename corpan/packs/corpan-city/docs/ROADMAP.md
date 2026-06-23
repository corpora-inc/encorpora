# Corpan City — Scale-Out Roadmap (synthesis of the 7 facet docs)

All seven facet designs are written (see `docs/NEXT_LEVEL_PLAN.md` for the index).
This is the **consolidated, dependency-ordered build sequence** across them. Nothing
here is implemented yet — it's the plan to choose slices from.

## Dependency graph (what must precede what)
```
LANGUAGE_PAIR_STATE (Track storage seam)  ──┬─→ ECONOMY (per-Track wallet)
                                            ├─→ BADGES (per-Track progress)
                                            ├─→ IMMERSION (per-Track flag)
                                            └─→ ANALYTICS (active-Tracks signal)
LOCALIZATION (string + prompt seams) ───────┬─→ IMMERSION (selects which side to show)
                                            └─→ every user-facing surface (econ/badge/map UI)
CONTENT/item-art ───────────────────────────→ ECONOMY + BADGES icons (shared renderer)
Cohesion M2/M3/M4 (in progress) ────────────→ folds INTO economy+badges (M4 = the new wallet/badge UI, not a plain item list)
```
**Keystone:** `LANGUAGE_PAIR_STATE` Phase 0 (TrackId namespacing + IndexedDB storage
seam) — almost everything stores per language pair, so this unblocks the rest. It's
mostly invisible plumbing but it's the gate.

## Build waves (recommended order)
### Wave A — Foundations (invisible but unblocking)
- **Track-state P0+P1**: `TrackId = native:target`, IndexedDB `trackStore`, namespace
  inventory/quest/badges, one-time migration of today's single save, a 2-Track
  in-game switcher. *Verify in the real embedded app.*
- **Localization L0**: cut the string seam (`src/i18n/strings.ts`) + prompt-instruction
  seam (`src/i18n/prompt.ts`), `en`-only — a pure refactor, zero behavior change.
- **Content item-art (P1)**: procedural `itemArt` icon renderer — **kills the emoji
  placeholders** and gives economy + badges their shared icon system.

### Wave B — The reward overhaul + cohesion you can SEE
- **Economy E0+E1**: multi-currency `Wallet`, denominations rendered as stacks of
  bills/ingots, scene-appropriate reward tables — **the moon-coin dies** — plus NPC
  currency exchange + a simulated market (no server yet).
- **Badges B0+B1**: the XP→badge router, the in-overlay Badge Case (new menu tab),
  the focus-badge HUD chip replacing the static ✨, the generative ~1000 catalog.
- **Cohesion M2+M3**: special quest NPCs (lights up the clue→item→deliver dialogue) +
  the minimap/full map. **M4 inventory = the wallet + badge + give/deliver UI** (it
  was always going to be this, not a plain list).

### Wave C — Reach + depth
- **Localization L2+L3**: generate all 50 languages (gated; advertise only green),
  RTL/script/TTS-gap polish.
- **Immersion**: the per-Track off/reveal/on toggle + resolver seam.
- **Content fan-out (P1→P4)**: face-kit, topology-generator, wardrobe, theme/era
  library, quest-generator, persona-mood, 8 new ChallengeTools, the diegetic
  WorldExperience seam, Spark asset kit.
- **Economy E2-E4**: live global price ticker, player↔player exchange, order book (server).
- **Analytics**: anon aggregate pulse (PENDING the principle decision below).

## Cross-cutting decisions for the owner
1. **Analytics principle — DECIDED (owner, 2026-06-03):** go with the amendment
   (option a). Constraints from the owner, NON-NEGOTIABLE:
   - **Reuse the EXISTING global analytics opt-out in Corpán's main app settings** —
     READ that value; do NOT build a new opt-out. Opted-out ⇒ zero egress.
   - **Anonymous, high-level aggregates ONLY.** The whole payload is essentially:
     **which language PAIR · which COUNTRY · for how LONG** (session duration). No
     PII, no identifiers, no content, no precise time/geo (country = coarse
     region/locale, anon).
   - **No performance impact**; **offline still fully works** (queue/skip, never block).
   - **Cheap** — minimal data + storage + transport; tiny infrequent batched pulses.
   `ANALYTICS_PULSE.md` should be trimmed to this minimal scope (pair × country ×
   duration), dropping the heavier funnel set for v1. Build in Wave C.
2. **Open questions** — each facet doc ends with 4-6 owner questions (currency set +
   Weimar mark; badge HUD chip-only; immersion default; per-Track vs global identity;
   etc.). Worth a pass before the relevant wave.

## Recommended FIRST slice
**Wave A Track-state P0/P1 + Economy E0** together: the foundation (per-Track state +
migration) plus the most-wanted visible payoff (kill the moon-coin → a multi-currency
wallet that renders as stacks of bills). Item-art (Content P1) rides along so the
currencies/items have real icons, not emoji. That's a coherent, demoable first wave
with the foundation underneath it.

## Orchestration notes
- `game.ts`, `styles.css`, `worldLook.ts`, `contracts/*` are **orchestrator-owned**
  (serialized through one owner per merge window); every facet lands its wiring behind
  the data getters/hooks it defines, so diffs stay additive + non-overlapping.
- Each wave fans out to disjoint-file agents; verify in the **real embedded app**
  (the standalone-vs-embedded trap bit us repeatedly).
