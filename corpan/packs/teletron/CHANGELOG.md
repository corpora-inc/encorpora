# Teletron Changelog

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
