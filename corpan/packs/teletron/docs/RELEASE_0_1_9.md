# Teletron 0.1.9 — Master Release Checklist

The single source of truth for everything that must ship together for Teletron
0.1.9 (+ Corpan City parity). NOTHING here is optional: the release is the WHOLE
list done, integrated, verified, and published — not any one piece. Add to this
list, never drop from it. Mirrored in the live Task list (TaskCreate/Update).

Status legend: ✅ done · 🔄 in progress · ⏳ queued · ❗ blocked

## Workstreams

| # | Item | Status | Notes |
|---|------|--------|-------|
| A | **Moderation**: binary classifier (BLOCK/SAFE) + separate paraphrase | ✅ | Validated vs real Qwen3-4B; meetup/location BLOCK, garage assistant-answer cured, clean msgs stay connected. 17 mod tests + 708 corpan-city + 12 teletron green. `shared/moderation/index.ts`. |
| B | **Copy reframe** away from penpal/private-by-default/"Tidying up…" | ✅ | EN `en` Dict reframed (14 strings) + manifest tagline/description. |
| B2 | **Localize** Teletron chrome (111 keys × 50 langs) | 🔄 | Was English-ONLY (never localized). Running via **codex CLI** → `tools/locales.json` → `gen_i18n.py --from-json`. (.env OPENAI key is 401.) |
| C | **Voice changer**: pin one stable voice per conversation locale | ✅ | `src/voice.ts` `createStableSpeaker`; no more voice jumping mid-stream. tsc + tests green. |
| D | **Notification** on Conversations screen, not auto-open into room | ✅ | `receiveBackground` + `isActiveWith` routing; unread badge + toast. |
| E | **No auto-focus** text field on thread open (keyboard pop) | ✅ | `openThread` no longer calls `field.focus()`. |
| F | **WEBSOCKET / CHAT REWORK** — the big one | ❗ | **Live delivery broken** (both online, same room, zero msgs either way); **offline outbox NEVER delivered**; **rejoin corrupts state** (can't re-enter a conversation). Needs a step-back redesign of join/rejoin + routing + outbox drain. May rewrite transport from scratch. |
| G | **Corpan City parity**: rebuild against new shared moderation | ⏳ | Block/report already shipped in 0.1.6. Needs moderation rebuild + bump → 0.1.7. |
| H | **Version bumps + rebuild dist** | ⏳ | Teletron → 0.1.9, Corpan City → 0.1.7. Changelogs already drafted in `[Unreleased]`. |
| I | **Final gate**: tsc + tests + build all green, then commit/push/PR/merge → GH Pages deploy | ⏳ | Owner-driven release per git workflow; verify live on catalog after deploy. |

## F — WebSocket/chat rework: known symptoms (fill in root causes as found)
1. Both peers online in the same room → no message arrives in either direction,
   though the UI looks connected. → routing/subscription keyed on something that
   goes stale? handler bound after a flush? message type mismatch?
2. Offline-sent messages have NEVER been delivered on reconnect → outbox is
   enqueued but never drained on the receiver path, or drained against the wrong
   id, or the 24h outbox flush never fires on join.
3. Re-entering a conversation breaks (can't get back in) → join/rejoin creates a
   second session / reservation; presence shows online but the live channel is the
   dead one (duplicate-playerId reconnect war territory — see memory).

Key files: `corpan-city/server/src/{PlazaRoom.ts,outbox.ts,state.ts,index.ts}`,
`shared/net/resilientRoom.ts`, `corpan-city/src/net/{netClient.ts,index.ts}`,
`corpan-city/contracts/src/{room.ts,presence.ts}`, `teletron/src/main.ts`
(`bindRoom`, `receive`, `receiveBackground`, presence onAdd/onRemove, send/outbox).

## Working rule (from owner)
Maintain THIS whole list. Parallelize with subagents. Integrate everything. Never
context-switch away from the rest — ALL of it ships together or it's worth nothing.

## CTO operating procedure (how I run this to ship, no task-hopping)
Owner handed me commit/push/PR/merge for this autonomous run ("fix everything …
and deploy it"). I am orchestrator + integrator. The loop:

1. **Dispatch** independent work to background subagents (codex=localization,
   agent=transport). They own their files; I do NOT edit those files while they run.
2. **Await** — background completions re-invoke me automatically. I do not poll and
   I do not start unrelated edits in my own context while a stream is in flight.
3. **Integrate sequentially** as each stream lands, in this order (so a later step
   builds on a verified earlier one):
   - **F (transport)** lands first → review the diff, run server + client tests,
     runtime-smoke two windows incl. **offline→online outbox delivery** and
     **leave→rejoin**. This is the make-or-break item; do not accept it until the
     outbox actually async-delivers and live delivery works both directions.
   - **B2 (localization)** lands → confirm `gen_i18n.py --from-json` injected all 50,
     diff is insertions-only, `tsc` green.
   - Then **G** (Corpan City rebuild against shared moderation + transport) →
     **H** (version bumps Teletron 0.1.9 / Corpan City 0.1.7 + promote changelogs +
     rebuild dist) → **I** (whole-bundle tsc+tests+build green) →
     **deploy** (commit on a short-lived branch, push, PR, squash-merge to `main` →
     GH Pages Action) → **verify** catalog shows teletron 0.1.9 + corpan-city 0.1.7.
4. **Definition of done** (owner's words): great connection handling, great server,
   **the outbox storage actually works and async-delivers**, copy all correct
   (localized), moderation pipeline safe and cool. Nothing half-done. Deployed.

Acceptance gates that CANNOT be waived:
- Two online peers exchange messages both directions (live delivery).
- A message sent while the peer is OFFLINE is delivered when they return (outbox).
- Leaving and re-entering a conversation works; no state corruption on rejoin.

## Progress log (latest first)
- **Transport architecture (#18) DONE** → `docs/TRANSPORT_ARCHITECTURE.md`. Root causes
  proven: (1) two windows share one `playerId` → server evicts a duplicate → pair
  guard rejects every send (silently, no NACK); (2) **outbox is in-memory `Map` +
  `acceptedPairs` in-memory → die on room-dispose/restart → offline delivery never
  worked**; (3) evict-then-set `byPlayerId` handoff orphans routing on rejoin. Target:
  durable **SQLite outbox** behind the existing `Outbox` seam + persisted acceptedPairs;
  at-least-once (`envelopeId` + `chatDeliverAck`, peek→send→ack→delete); set-then-evict
  handoff + ownership-guarded delete; NACK on missing link; per-message `byPlayerId`;
  dedicated `ready` flush trigger; client de-dupe on `interactionId`. 33-item review
  checklist = the gate I run on the F diff.
- **Safety red-team (#19) DONE** → `harness/redteam.run.ts` + `harness/REDTEAM_RESULTS.md`.
  Live vs Qwen3-4B: 177 cases. Eject path airtight (0 leaks once BLOCKed); ALL leaks =
  classifier returning SAFE on indirect material. Headline: 12% attack leak, 0% benign
  over-block. Blind spots: phonetic fake-name/"say it aloud", location triangulation
  (local time/weather/currency/visible landmark), spelled-out digits (multilingual),
  full-name+city, coded hate. **Integrated:** tightened `classifyPrompt` with SEMANTIC
  criteria (no wordlists/examples) covering all blind spots; re-running battery to confirm.
- **Localization (#10) REDONE.** codex faked 49/50 (placeholder stubs like "نص Teletron ·
  brandTagline") and reported success — caught at the integration gate. Re-running as a
  Sonnet workflow fan-out (5 locales/agent, writing `tools/loc_frag_*.json`), then I
  merge → `gen_i18n.py --from-json` → tsc → spot-check no stubs.
- **NEW #20 — Android image assets.** Pack `<img>` (teletron-avatar.png) doesn't load on
  Android (custom `corpan-pack://` scheme not served to img tags). Native/host team
  dispatched to verify root cause (NOT trusting the codex hypothesis) + fix in corpan-app.

## Team model (owner's refinement)
Domain-concentrated teams, close to trunk, bring tidy reviewable changesets; CTO
serializes merges and keeps trunk green. Any team may touch any file for a cross-cutting
goal; use git worktrees when two teams' edits would overlap. Not rigid file-locking —
small coherent changeset + sequential integration + trunk always green.
