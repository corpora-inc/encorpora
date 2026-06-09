# Teletron Changelog

## [Unreleased]

- Fix an "online ↔ reconnecting" reconnect war: two live Teletron instances
  (a React StrictMode double-invoke or a hot-reload/re-mount that didn't unmount
  the previous one) each opened a presence connection with the SAME persisted
  playerId, so the server replaced the older session ("replaced by newer
  session"), the replaced one fresh-joined with an invalid reconnect token and
  replaced the other, and they ping-ponged forever. Mounting is now idempotent
  (guard state on `globalThis`, surviving hot-reload), so exactly one connection
  is ever live. Pre-existing; rare in a clean prod install, common in dev.
- Reframe Teletron's copy as warm "safe penpals" rather than "AI-mediated /
  local AI relay" jargon, and move all chrome through a new `src/i18n.ts`
  (English ships now; locales fill in via `tools/gen_i18n.py`, whose targets
  come from the manifest's `displayName`). One honest on-device line is kept in
  the privacy section.
- Rebuild Teletron as a messaging app: the home is now an **inbox** of
  conversations (unread badges, online dots) instead of a lobby with one
  embedded thread. Leaving a thread (**Back**) or **Exit to Corpan** keeps the
  socket/link and outbox alive so you can come back later; **End conversation**,
  **Block**, and **Report** moved into a three-dot overflow menu and are the only
  actions that tear a link down. Conversations persist as read-only keepsakes
  when ended.
- Support multiple simultaneous penpals (free = 1, Corpán Plus = up to 100):
  background-thread messages land in the inbox with an unread badge without
  interrupting the open thread; a free user at the cap gets a choice sheet
  (keep current / start new / go Plus) instead of a silent end.
- Fix the duplicate Teletron logo on iPad (removed the redundant hero mark; the
  header keeps the single brand mark).
- Rework the local mediation pipeline (`@shared/moderation`) from a fixed
  seven-pass cascade into Scrub → Drift → Recompose: a deterministic scrub of
  contact/identity/place material, a risk probe that lets clean lines skip
  straight to a single creative-polish pass (and escalates risky lines through
  the semantic cascade), corpus-phrase seeds that replace the dead canned
  fallbacks, and prompts that no longer collapse to a tutor/assistant voice.
- Translation prompts now prefer a full in-language directive (best for
  non-Latin scripts) and apply a CEFR level band (A2 simple → B natural → C2
  erudite) drawn from the recipient's learning stack.

- Fix async-penpal delivery losing messages when the recipient steps away by
  exiting Teletron (Back / pack switch). The pack's `unmount` was sending
  `chat-control { action: "ended" }` whenever the chat was active and the
  partner was online — the server treated that as a deliberate end-of-chat
  and ran `forgetAcceptedPair`, which also calls `outbox.removeForPair` and
  drops every still-buffered envelope between the two players. Any later
  message from the partner was then rejected at the accepted-pair guard.
  Only the explicit End button and Block actions should send `ended`.
- Bind room message handlers (especially `chatDeliver`) before calling
  `publishProfile()` on every (re)join. The server's `profilePublish`
  handler synchronously drains the outbox and sends each buffered
  `chatDeliver` to the client; if `publishProfile()` ran before the
  handler was bound, a hot reconnect could land the flushed messages
  before the listener existed and silently drop them. Now matches the
  server-side comment's stated invariant.
- Fix the gray-square that rendered on the right side of speakable message
  bubbles: the speaker-icon CSS was using `polygon()` as a mask layer, which is
  a `clip-path` value and not a valid mask source — every browser dropped the
  mask entirely and filled the box with `currentColor`. Replaced with a proper
  inline-SVG speaker mask.
- Add a `scripts/pack.mjs` (`npm run pack`) that bundles `teletron-avatar.png`
  alongside `manifest.json` and `dist/` into `teletron.zip`. The brand avatar
  is referenced by `main.ts` via `packAssetUrl()`, but the previous ad-hoc zip
  shipped only `manifest.json + dist/`, so the logo broke on platforms that
  resolve pack assets from the downloaded zip (e.g. Android). iOS happened to
  work because its plugin copies the pack from the iOS app bundle, which
  already contained the PNG.

## 0.1.7 - 2026-06-08

- Add Block and Report safety controls (required for an all-ages social space):
  a shield button in the chat opens Block / "Report & block". Blocking hides the
  person from your waiting room, suppresses their invites and messages (server
  mirror tears down the link + drops any buffered messages), and removes the
  conversation from your device. Reporting sends only minimal moderation
  metadata — never your message text.
- Async penpal delivery: a message to a partner who is momentarily offline is
  now held by a bounded, self-expiring server buffer and delivered the moment
  they return — no more "they stepped away, can't send." The conversation stays
  a living link for 24h; you can keep it going indefinitely as long as you both
  write within a day, after which it gently drifts to a close.
- Hold the presence seat across a brief background/network drop (90s) so a quick
  return reconnects in place and your partner never sees you leave.
- Make the presence connection resilient: a dropped socket now reconnects
  automatically (token rejoin, exponential backoff, and immediate retry when the
  app returns to the foreground) instead of ending the conversation. The chat
  header shows "Reconnecting…" and resumes in place.
- Persist conversations on-device (IndexedDB): reopening Teletron restores a
  still-living conversation, and every exchange is kept as a permanent transcript
  even after a chat ends.
- Treat a partner leaving as "stepped away" rather than a hard end — the thread
  stays open and resumes if they return; a lapsed conversation becomes a
  read-only keepsake (dormant) rather than disappearing.

## 0.1.6

- Publish the latest Teletron streaming chat, mobile layout, localized language selector, and safe-relay place blurring under a new pack version for users already on 0.1.5.

## 0.1.5

- Stream received text into the visible chat bubble before queuing sentence-complete TTS, so speech no longer starts before words appear.
- Queue speech for back-to-back incoming messages instead of cutting off the first message when another arrives.
- Let the message composer grow with multi-line text while keeping a polished capped height.
- Add Tutomaton-style iPad top chrome clearance so resized tablet windows clear the floating controls.
- Add a focused safe-relay pass for specific place names and prevent obvious city-plus-state locations from crossing the wire.
- Show localized language names in the intro selector and hide stack languages that are not in Teletron's Qwen3 relay allowlist.

## 0.1.4

- Add Tutomaton-style streaming TTS for received chat: target-language translation tokens are sentence-buffered and spoken before the full mediated artifact finishes.
- Add a voice mute toggle and tap-to-replay affordance for peer messages.
- Polish the mobile layout with safe-area-aware header/conversation insets, compact phone chrome, richer message cards, and a more premium glassy waiting-room/chat treatment.
- Make the phone chat layout stateful so the waiting-room header and active-chat header do not stack, and the composer stays pinned without a dead band below it.
- Add polished chat lifecycle handling: active partners show as chatting, busy users auto-decline new invites, End notifies the peer, disconnects close the live composer, and stale in-flight sends are dropped.
- Keep the dictation mic visible but disabled when native ASR is unavailable on a phone, and re-probe ASR when the selected chat language changes before entering.

## 0.1.3

- Retry Qwen3 4B model loading with an unload/reset path so a stale or memory-stressed runtime can recover without restarting Corpán.
- Prime relay translation prompts in every supported output language, including native-script prompts for Telugu, Tamil, Punjabi, and other non-Latin scripts.

## 0.1.2

- Replace peer chat mediation with the shared safe relay pipeline: local raw text is transformed into English relay text before routing, then independently cleaned and translated on the recipient device with plain-text LLM calls.

## 0.1.1

- Include `teletron-avatar.png` inside the installable pack ZIP so the in-pack logo renders after installation.

## 0.1.0

- Initial Teletron release.
