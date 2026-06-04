# World Plaza — MASTER BACKLOG (the must-solve-before-first-ship list)

> Single source of truth for everything the owner has asked for. Nothing ships
> until **all** of this is solved + verified in the REAL embedded app. Maintained
> by the orchestrator (PM mode): record every request, fan out full-context agents
> per facet (agents may spawn their own sub-agents), integrate, verify, update status.
>
> Status: `DONE` (verified) · `BUILT` (built, owner not yet verified) · `IN-FLIGHT`
> (agent running) · `DESIGNED` (plan ready, not built) · `QUEUED` (recorded, not started).

---

## A. FOUNDATIONAL / BLOCKING

| # | Item | Status | Notes |
|---|------|--------|-------|
| A1 | **Stack/language reactivity** — world-plaza must FULLY derive from the Corpán stack (target/native langs). Currently `learnerPair` is hardcoded `es/en` from the quest JSON (the bug: switched stack to EN-from-ES, world still EN→ES). Multi-target stack → premium **language-chooser interlude**. Exit → flip stack → return → whole game reflects new stack. Premium **welcome/onboarding** into world-plaza. Single-language stack must work (SINGLE_LANGUAGE_RULE). | **IN-FLIGHT** | Agent: *World Entry / Stack Reactivity*. The front door — everything depends on it. |
| A2 | **Quest simplification** — deterministic, hand-holdy, easy, juicy loop: go to the starred NPC → clear "Begin" → challenge → juicy reward → advance / quest-complete. Fixes "talked to the guy, nothing happened" (non-deterministic launch; no-toolId steps can't advance). 1-challenge beginner quests → up to 5. **Juicy completion + animated interlude** + **2–3-way next-quest picker** (each: where-to-go + what-to-do). Data-driven quest catalog. Hooks for future dedicated video/animation interludes. | **IN-FLIGHT** | Agent: *Quest Loop Determinism*. Design saved at `plans/…-agent-a88eeb1410895d7bd.md`. Depends on A1's `learnerPair`. |

## B. CORE LOOP / NPC

| # | Item | Status | Notes |
|---|------|--------|-------|
| B1 | NPC dialogue quality (Qwen3): less repetitive, surprising-not-crazy, leveled, target-language only (de-gloss), ≤~200 tokens. | BUILT | R1/R2 + segue-decouple done; needs on-device re-judge. |
| B2 | **Sticky per-NPC TTS voice + correct gender + best-voice fallback.** | BUILT | Host `listVoices`/`speakVoice` wired; gender best-effort (no character gender field yet → consistent-not-matched). Needs on-device audio verify. |
| B3 | Deterministic clue/item grant (no model hallucinating grants). | DONE | |
| B4 | Hardcoded ~10k challenge segues (20 tools × ~10 × ~50 langs). | DESIGNED | Bank seeded (`challengeSegues.ts`); scale to all langs. |

## C. WORLD / ART / PERFORMANCE

| # | Item | Status | Notes |
|---|------|--------|-------|
| C1 | One fictional **Corpan City** (no real-geo lies); big streaming city. | DONE | |
| C2 | **Streaming performance** — no in-play hitch; bounded memory. | DONE | Shared caches + per-building time-slice + background warm + shared tileable ground + OffscreenCanvas façade worker. Mem 123 MB, no mid-walk hitch (verified cold). |
| C3 | Proportions (fit through doors) + believability ("less cutesy, cooler"). | BUILT | H_P-relative buildings; needs owner eyeball at a door. |
| C4 | Vista occlusion fix + depth-buffer z-fight fix. | DONE | |
| C5 | Phantom fountain collider removed; **real fountain centerpiece** (visible + collider). | QUEUED | Collider removed; visible fountain pending. |
| C6 | Density-near-spawn / NPC population streaming (feel alive). | QUEUED | |
| C7 | Light & atmosphere pass (time-of-day, harbor water, grading). | QUEUED | |

## D. ENTERABLE SUB-EXPERIENCES (VIGNETTES)

| # | Item | Status | Notes |
|---|------|--------|-------|
| D1 | Vignette framework + **taxi** reference (back-seat, driver NPC, fare, transit). | DONE | |
| D2 | Vignette **roster**: café, bank, bus, subway, airport, restaurant; **building doors as portals**. | QUEUED | Seam proven; fan out after A1/A2 land. |

## E. SOCIAL / MULTIPLAYER

| # | Item | Status | Notes |
|---|------|--------|-------|
| E1 | Colyseus presence + **Area-of-Interest** (scales to big city). | DONE | Server-side; near-sees-near verified. |
| E2 | Network mode (subscriber): trade, **currency exchange**, **LLM-mediated chat**, head-to-head **challenges**. | QUEUED | Contracts exist (`InteractionRequest`, `MediatedChatArtifact`, `EconomyTransaction`). |
| E3 | Multiplayer deploy / matchmaking / room directory. | DESIGNED | |

## F. ECONOMY / PROGRESSION

| # | Item | Status | Notes |
|---|------|--------|-------|
| F1 | Multi-currency wallet + markets/exchange (kill the gray moon-coin). | BUILT | |
| F2 | XP → badges (per-language, ~1000/lang). | BUILT | |
| F3 | Per-language-pair **Track** state (up to 2,450 arcs) + switcher. | BUILT/DESIGNED | Ties to A1. |

## G. UX / CHROME / MAP / ONBOARDING

| # | Item | Status | Notes |
|---|------|--------|-------|
| G1 | **FAB / chrome premium polish** (`docs/FAB_POLISH.md`): minimap chrome-visibility bug, unified material/type/icon language, sticky sub-headers, scroll fades, warm badge grid, de-emoji. | DESIGNED | P0+P1 ready to build. |
| G2 | Map: compass flip + follow-cam minimap. | DONE | |
| G3 | **On-road wayfinding arrow** (subtle, muted, points to objective). | DESIGNED | `roadArrow.ts` built, not wired — fold into A2. |
| G4 | Premium onboarding + completion celebrations + **story interludes**. | IN-FLIGHT | Split across A1 (entry) + A2 (completion). |

## H. LOCALIZATION / CONTENT / IMMERSION / ANALYTICS

| # | Item | Status | Notes |
|---|------|--------|-------|
| H1 | 50-language localization of minigames + LLM prompts + segues. | DESIGNED | |
| H2 | Per-Track **total-immersion toggle**. | DESIGNED | |
| H3 | Anon **analytics pulse** (pair × country × duration; respect global opt-out; offline-safe). | DESIGNED | |
| H4 | Content variety scale-out (per-pair generation). | QUEUED | |

## I. SHIP / INFRA

| # | Item | Status | Notes |
|---|------|--------|-------|
| I1 | Publish 0.1.0 to catalog + artwork. | QUEUED | |
| I2 | GH Actions / GH Pages. | QUEUED | |
| I3 | Terraform / AWS infra. | QUEUED | |

---

## PARALLELIZATION MAP (how the work is broken down to run concurrently)

The only real blocker to "all domains at once" in one codebase is **shared files** —
above all `src/game.ts` (the orchestrator wiring) and `src/styles.css`. So each
domain agent OWNS a disjoint set of files/dirs, may spawn its OWN sub-agents, and
returns a **`game.ts` integration note** instead of editing it; the orchestrator
serializes `game.ts`. With that discipline, domains hum in parallel.

| Domain agent | OWNS (writes) | Reads/reuses | Returns to orchestrator | Depends on |
|---|---|---|---|---|
| **A1 · World Entry / Stack** | NEW `src/entry/*` (welcome + language-chooser interlude); host-stack adapter | host `getStackConfig`/`onStackConfigChange`, Vignette host, SINGLE_LANGUAGE_RULE | `game.ts` note: derive `learnerPair` from live stack + subscribe to changes + show chooser on multi-target | — (foundational) |
| **A2 · Quest Loop** | `src/quest/*`, NEW `src/vignettes/questInterlude.ts`, `content/quests/*`, contracts quest schema, `src/npc/npcRuntime.ts` (deterministic Begin) | challenge/reward/juice, Vignette host, the saved quest design | `game.ts` note: engage→Begin→challenge→advance + completion interlude + active-quest swap | A1's `learnerPair` (read, don't hardcode) |
| **G · FAB / Chrome / Map** | `src/shell/*`, `src/map/*`, `src/styles.css`, wire `src/wayfinding/roadArrow.ts` | `docs/FAB_POLISH.md`, chromeVisibility | `game.ts` note: minimap chrome register + road-arrow wiring | — |
| **C · World Detail** | `src/world/*` (visible fountain + collider, light/atmosphere), NEW `src/city/population*` (density streaming) | perf streaming (additive only — DON'T regress) | `game.ts` note if any | — |
| **E · Social / Network** *(wave 2)* | `server/*`, NEW `src/net/*` + `src/chat/*` | contracts (`InteractionRequest`, `MediatedChatArtifact`, `EconomyTransaction`), AOI | `game.ts` note: social UI hook | — |
| **B · NPC Dialogue** *(wave 2)* | `src/npc/promptProgram.ts`, `challengeSegues.ts`, `npcVoice.ts` | — | — | A2 settles `npcRuntime.ts` first |
| **D · Vignette Roster** *(wave 2)* | NEW `src/vignettes/{cafe,bank,bus,subway,…}.ts` + door portals | Vignette host, taxi ref | `game.ts` + `vignettes/index.ts` note | A2 settles `vignettes/index.ts` |
| **H · Loc / Immersion / Analytics** *(wave 2)* | NEW `src/analytics/*`, immersion toggle, loc tooling | global opt-out, segue bank | `game.ts` note | — |
| **I · Ship / Infra** *(wave 3)* | `scripts/*`, `infra/*`, manifest, catalog | — | — | most domains done |

### Waves
- **WAVE 1 (humming now, fully disjoint):** **A1, A2, G, C.** No two write the same
  file; all return `game.ts` notes the orchestrator integrates.
- **WAVE 2 (launches as Wave 1 integrates — they touch files Wave 1 settles):**
  **E** (independent, could start early), **B** (after A2's `npcRuntime`), **D**
  (after A2's `vignettes/index`), **H** (independent).
- **WAVE 3:** **I** (ship/infra) once the product domains are satisfactory.

> "Satisfactory" per domain = built + verified in the REAL embedded app (not just
> standalone) + owner eyeball. The orchestrator integrates each agent's note, builds
> once per integration, and updates status here. Nothing ships until every row is `DONE`.
