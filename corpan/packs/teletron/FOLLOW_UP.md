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

1. Pass Plus entitlement into content packs.
   - `ContentPackHost` currently passes `stackConfig` only.
   - Teletron already checks `initialState.isPlus`, `initialState.entitlement.plus`,
     and `globalThis.__CORPAN_PLUS`, but the real host likely does not set them.
   - Until this is wired, all real users will probably see the free 20/day client
     quota even if they are Plus.

2. Publish/package Teletron artifacts.
   - Build the pack ZIP and manifest under the existing catalog publishing flow.
   - Confirm the catalog points to an artifact that exists on the CDN.
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
   - The server should receive a signed entitlement proof or app-issued session
     token, then enforce free/Plus message limits.
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
   - For real quota/block/report enforcement, introduce a signed anonymous session
     identity that does not expose account details to peers.

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

## Open product decisions

- Is 20 free messages/day the right initial number, or should it be per-chat?
- Should free users be allowed to install the 2.5 GB Qwen base model, or should
  Teletron offer a degraded non-LLM waiting-room preview when the model is absent?
- Should the first launch be all stable users, or a stable catalog entry hidden
  behind an app-version minimum that only the upcoming release satisfies?
