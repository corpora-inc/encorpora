# Teletron follow-up plan

Teletron is now usable as a free social pack with a local daily free quota and
Plus-unlimited intent. The current release is good enough to test the core loop:
presence, invite/accept, mic input, local Qwen moderation, and mediated chat.

## Clarifications from the prototype

- "Language stack" means the user's learning stack, not a technology stack.
- `stackConfig.languages[0]` is treated as the user's native/base language.
- Every language after `stackConfig.languages[0]` is treated equally as a
  learning language.
- On entry, the user chooses which learning language Teletron should render the
  conversation in. The selected language is shown first in an opted-in profile;
  the other learning languages are carried as `alsoLearning`.
- Display names are generated only from curated adjective/noun lists. They are
  not IDs, collisions are harmless, and users can reroll before entering.
- The only peer-visible profile facts should remain: randomized non-UGC display
  name, optional language stack, and optional k-anonymous country/continent.
  This should stay aligned with Corpan City.
- Location remains opt-in and k-anonymous; no city, region, coordinates, handle,
  avatar upload, bio, or free-form profile fields are exposed.

## Initial release checklist

1. Pass Plus entitlement into content packs. Done for the initial release.
   - `ContentPackHost` passes a cached entitlement snapshot at mount, publishes
     `globalThis.__CORPAN_ENTITLEMENT` / `__CORPAN_PLUS`, and dispatches
     `corpan:entitlement-changed` when subscription state changes.
   - Teletron listens for that event and switches from the free 20/day quota to
     unlimited without calling StoreKit/Google Play per message.

2. Publish/package Teletron artifacts. Done in the Pages deploy workflow.
   - The workflow builds the pack, writes `/corpan/packs/teletron.zip`, copies
     `manifest.json`, `dist/`, and `teletron-avatar.png`, and publishes the
     localized catalog entry.
   - Launch as `purchase.type = free`, with Plus only affecting limits.

3. Add a visible block/end affordance.
   - Current chat can end locally, but we need clear "block this person" behavior.
   - Block should suppress future invites from that `playerId` for the session and
     ideally persist a short-lived device-local block list.

4. Smoke-test in the real app shell on iOS/Android.
   - Qwen install/load flow.
   - ASR/mic permission flow.
   - Two devices, invite/accept, send/receive, offline/reconnect behavior.
   - Free quota and Plus-unlimited display once entitlement is wired.
   - Generated-name reroll and chat-language selection with multi-language stacks.

5. Add basic production observability.
   - CloudWatch or SSM-accessible container logs are currently available, but there
     are no alarms.
   - Add alarms for instance status checks, high memory, disk pressure, and server
     restarts.

## Hardening after first release

1. Server-side quota and entitlement.
   - Move the free daily quota from localStorage to the presence server or a small
     entitlement/quota service.
   - Do not trust `initialState.isPlus` or a client-sent boolean for production
     enforcement. The host-side flag is for UX and honest-client behavior only.
   - Current backend state: `corpan-verify-purchase` verifies Apple/Google when
     the app posts a transaction or purchase token, but it does not persist a
     subject entitlement record, and the Apple/Google notification handlers only
     log events. `/subscription-status` still requires store proof from the
     client; it is not a reusable server-side entitlement source.
   - Target shape: app refreshes IAP occasionally, backend verifies the StoreKit
     signed transaction or Google purchase token, stores `{ subject, platform,
     originalTransactionId/orderId, plus, expiresAt, updatedAt }`, and returns a
     short-lived first-party token scoped to Teletron.
   - Presence server verifies that first-party token on join/message. Valid Plus
     token means unlimited; missing/expired token means server-enforced free
     quota.
   - Add one stable anonymous app subject, generated once on device and not shown
     to peers. The token subject should be this app subject, not the Teletron
     display name and not the client-editable `playerId`.
   - This avoids calling Apple/Google per message while still handling expiry,
     cancellation, refund, and restore flows.
   - This is required before the quota can be considered abuse-resistant.

2. Abuse reporting and moderation audit trail.
   - Add a report flow that sends minimal structured metadata: reporter session,
     reported session, timestamps, moderation decisions, and hashes/snippets of
     mediated text if policy allows.
   - Avoid collecting raw user drafts unless the product/legal decision explicitly
     changes.

3. Load test and capacity envelope.
   - Establish measured limits for `t4g.micro`: idle sockets, active chat pairs,
     invite bursts, and Corpan City movement traffic.
   - Set an operational cap and a one-command resize runbook for `t4g.small`.

4. Global model asset management.
   - Teletron and Corpan City both need Qwen3 4B.
   - The app should own shared model discovery, install, status, and disk cleanup
     instead of each pack carrying its own probe/install copy.

5. Room/session identity.
   - Current identity is anonymous and device-local.
   - Teletron now replaces duplicate live sockets with the same `playerId` on
     the server, so one install should not accumulate redundant waiting-room
     presence. The first socket closes with code `4000` and reason
     `replaced by newer session`.
   - This replacement is per live room process. Because Teletron currently uses a
     high `maxClients` and fill-first matchmaking, duplicates from one install
     should normally land in the same room; a future multi-room/process deployment
     needs a shared registry if duplicate eviction must be global.
   - For real quota/block/report enforcement across devices, introduce a signed
     anonymous account/session identity that does not expose account details to
     peers.

6. Moderation evaluation.
   - Build a small adversarial test corpus for contact-info leakage, meet-up
     attempts, sexual content, threats, targeted abuse, and prompt injection.
   - Run it against both outbound and inbound prompts before broadening traffic.

7. Reliability polish.
   - Better reconnect UX when the socket drops.
   - Backoff and retry for model install/load failures.
   - Clear empty-room behavior and invite timeout state.

8. Localized generated names.
   - Expand the adjective/noun tables across scripts and languages.
   - Consider selecting candidate name pools from the user's active stack, so a
     learner might see names in languages they are studying.
   - Keep the names curated and non-UGC; no free-form display names and no numeric
     suffixes. Collisions are acceptable because display names are not identities.

## No-server-state penpal architecture — status (0.1.7, next-trunk)

Landed (Phase 1 + Phase 2 core):
- Resilient connection: `shared/net/resilientRoom.ts` (token rejoin, backoff,
  foreground wakers); Teletron auto-reconnects instead of ending the thread.
  Teletron room now holds a 90s reconnect seat (was 0).
- On-device transcripts: `src/transcripts.ts` (IndexedDB) — permanent history,
  restore a still-living conversation on cold open. The server keeps NO history.
- Async delivery: `server/src/outbox.ts` — a shared, bounded, self-expiring
  store-and-forward buffer; messages to an offline penpal are delivered on their
  return and deleted; 24h living link, then the link drifts away.
- Safety: device-local block list + server `block`/`report` enforcement.

Remaining for this architecture (next increments, not yet done):
- **Multi-penpal UI (Plus = 3 simultaneous; free = 1).** Today Teletron is a
  single-conversation UI (free's 1-penpal is inherent). Plus's 3 penpals needs a
  conversation-list/switcher; the server outbox + links already support it.
- **30-min/day live (synchronous) time budget for free.** Async replies are
  unmetered; only live both-present time should be budgeted. Needs metering UX.
- **Durable outbox backend.** The outbox is in-memory (lost on server restart);
  acceptable as best-effort, but a SQLite-on-box or Redis backend behind the
  `Outbox` interface would make async delivery restart-safe.
- **Server-side report ingestion.** Reports currently land in container logs
  (CloudWatch). A real moderation queue/audit store is the next step.
- **Push notifications** (Phase 3) — handoff spec in the plan; alerts an offline
  user that a penpal wrote. Needs a native plugin + APNs/FCM.
- **Moderation adversarial corpus** (§6 above) — load-bearing for the
  store-sanitized-text-in-the-clear legal posture; build before broadening.

## Open product decisions

- Is 20 free messages/day the right initial number, or should it be per-chat?
- Should free users be allowed to install the 2.5 GB Qwen base model, or should
  Teletron offer a degraded non-LLM waiting-room preview when the model is absent?
- Should the first launch be all stable users, or a stable catalog entry hidden
  behind an app-version minimum that only the upcoming release satisfies?
