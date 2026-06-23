# Corpan City — Next-Level TODO

Live QA findings (2026-06-03), with owner. "[ME]" = orchestrator does it inline
(cross-cutting correctness); "[agent]" = parallel sub-agent.

## Correctness / input (root cause: dev double-mount) — [ME]
- [ ] **Dev double-mount**: the pack mounts TWICE in dev (console shows two
      `Loading pack corpan_city` + two Babylon boots) → two game instances →
      **doubled LLM streams, leaked input (WASDQE still acts while a chat is
      open — it's the 2nd instance's handler), doubled `e`.** Make `mount`
      idempotent (dispose any prior instance before creating a new one).
- [ ] **`e` is triple-booked** (engage NPC + camera-look + sometimes "enter").
      Remove `e`/Space as engage triggers entirely. `e` stays camera-look only;
      engage = Talk button or tap. No keyboard "enter/activate".
- [ ] **Modal gating**: confirm WASDQE is fully inert while an LLM chat is open
      (should follow from the double-mount fix; verify).

## World feel — [agents, parallel]
- [ ] **Crowd crowding** (`crowd.ts`): NPCs gather in a circle around an idle
      player. They should wander AIMLESSLY; a brief glance at most, then move on.
      Only a special QUEST NPC should actively seek + approach the player.
- [ ] **No bonafide minigames in NPC chat** (`dialogueUI`/`npcRuntime`/
      `promptProgram`): in the real app the challenge rarely launches (real LLM /
      scripted fallback doesn't reliably emit the `<<tool>>` call). Make offering
      a challenge ROBUST + deterministic — a "Play" suggested-reply chip and/or an
      auto-offer after a couple of turns — not dependent on LLM tool-emission.
- [ ] **More articulated faces** (`characterArt.ts`): eyebrows, eyes, mouth more
      expressive + varied + interesting across all NPCs (still wholesome).
- [ ] **Street/road still flickery** (`roads.ts`/`materials.ts`): diagnose
      z-fight vs. texture shimmer/moiré; fix (anisotropic filtering + mips on the
      road material, and/or remaining depth separation).

## In flight (already dispatched)
- [ ] Billboard-hybrid for paper-thin props (`dressing.ts`).
- [ ] App-wide storage→IndexedDB + quota-safe + local-first analytics (corpan-app).

## Done recently
- Vignette → screen-space CSS (welded). Faces de-villained. PBR roofs flicker-fixed.
- Every townsperson talkable (generated personas). Challenge→reward loop wired.
- Multiplayer presence (Colyseus) verified — two windows see each other.
