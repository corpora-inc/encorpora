# Finite offline practice packs

AMP's optional server API issues a small signed pool of practice problems for one licensed learner. This is a server foundation for an offline client: the web app and native app do not download, persist, or run these packs. Encrypted device storage, account-isolated queues, native signature verification, local scheduling, accessible offline screens, and physical-device acceptance are separate requirements.

A pack contains up to five eligible problem families, with three fresh variants of each family interleaved in a fixed order. Selection uses the existing mixed-practice planner's per-strand evidence and starting preference, with a strict ceiling for finite pools. Genuine prerequisite support and due review of the exact independently demonstrated family can cross that ceiling. Repeated selections are deduplicated, so sparse eligible catalogs produce smaller pools. No harder task is added merely to fill the pack. Only the first variant retains its selection reason; subsequent variants are labeled `variant`. This is a bounded snapshot of practice opportunities, not a locally adaptive curriculum or a calibrated assessment.

## Signed content and identity

The data-only `amp-offline-v1` envelope contains public problem objects, template versions, canonical grader version, selection reasons, capabilities, and separate inspectable self-check explanations and answers. Ordinary online public problem payloads do not contain answers. Self-checks in an offline download are inherently inspectable and cannot establish independent retrieval.

A compact JWS signs the exact UTF-8 JSON bytes using Ed25519 (`alg: EdDSA`, `typ: amp-offline+jws`) and an explicit key identifier. Whole-envelope integrity covers every embedded object; there are no external assets, executable code, unsigned URLs, or separate per-object digests in this format. Content is capped at 256 KiB before signing and 512 KiB in storage. A verifier must use a separately trusted public key, restrict algorithm/type/key identifier, validate the schema, and compare authenticated installation bindings. Reading an unverified token header must never select an arbitrary key URL.

The signed envelope binds a canonical HTTPS service identifier, opaque account binding, learner ID, opaque consent and grant snapshots, issuance time, and immutable expiry. HMAC bindings use a secret independent of the signing key, so signing-key rotation does not change account identity. Service identifiers must already equal URL canonical serialization and contain no credentials, query, or fragment. Changing the binding secret or service identity invalidates existing installations; it requires deliberate client recovery. Public signing-key distribution and native key rotation acceptance are not implemented by this server API.

Signature verification alone is not authorization to install or upload a pack. A client must obtain a fresh authenticated preflight and compare its service, account, learner, pack, authorization snapshot, and expiry against the verified envelope. Never infer account authority from a learner UUID or an ID token alone.

## API

All routes require the existing authenticated parent identity and owned nondeleted learner. Consent and an actual active grant are required even with development authentication. The signing service is disabled unless explicitly configured.

- `POST /api/v1/learners/:learnerId/offline-packs`: `{requestId, responseCapabilities?, figureCapabilities?}`. Returns `{packId, signedPack}`. The UUID request ID is idempotent only for the exact capabilities and a currently eligible pack. Changing the request body returns a conflict; an invalidated pack cannot be renewed by replaying its request ID.
- `POST /api/v1/learners/:learnerId/offline-packs/:packId/preflight`: `{}`. Returns current eligibility and authenticated installation bindings without receiving queued responses. A client must call this before uploading child learning data. Failure means it must keep its queue isolated and offer an explicit recovery or deletion choice, not upload automatically.
- `POST /api/v1/learners/:learnerId/offline-packs/:packId/attempts`: `{attempts:[{requestId,problemId,response}]}` with at most 15 entries. The server rechecks authorization under locks, even after a successful preflight. Device timestamps, claimed correctness, assistance declarations, and mastery fields are rejected.

Malformed request envelopes and authorization failures reject the entire request. Valid envelopes return individual receipts: `accepted`, `replay`, `conflict`, or `rejected`. One conflicting or invalid queue item does not block another valid item. First responses are immutable. Exact request/response replay returns the original attempt identity; changing a request's problem or response returns `request_reused`. A different request for an answered problem returns `problem_already_answered`. Invalid numeric syntax and foreign-pack problem IDs receive rejection receipts. Unexpected storage failures roll back the transaction; retrying the exact request is safe.

A pack stores at most 60 durable receipt records. Beyond that bound, new request IDs receive a terminal `receipt_limit` response without additional storage; existing receipt retries remain available while the pack is eligible. Clients must not repeatedly generate new IDs for the same queue item.

## Authorization and evidence

Packs expire after at most 24 hours, or earlier at the bound grant's end. Every consent-row write and every grant-row write changes a monotonic authorization revision, including an update that leaves the visible status and dates unchanged. A billing projection refresh that writes a grant therefore invalidates bound packs; event replay that performs no grant write does not. Withdrawal followed by re-enrollment under the same policy does not revive a pack. Grant revocation, reinstatement, replacement, or renewal does not extend an existing pack. Effective email-plus policy validity is checked through the existing consent rules as well.

Learning requests acquire the shared account lock and learner lock; privacy changes acquire the exclusive account lock. An upload waiting behind a committed withdrawal fails without storing responses. An upload that commits before withdrawal can appear in the parent's export. This cannot instantly erase an already downloaded pack from a disconnected device, nor can a device clock prove elapsed licensed time. A native implementation needs a documented expiry/clock and recovery policy rather than treating a mutable local clock as trusted authority.

Offline originals and attempts use separate tables. The ordinary online attempts endpoint cannot find their IDs. Reconciliation grades the saved immutable original with `grader-v1`; downloaded answers and current generator output are not trusted. Updating grading rules requires a new version dispatch while retained packs continue using their original grader. Saved originals are parsed with the supported generated-problem schema: future content/schema changes must retain readers for every stored original shape throughout the 30-day retention window. Retaining only an arithmetic function is insufficient.

Accepted activity is labeled `offline-provisional`. It never writes ordinary attempts, durable skill evidence, independent retrieval counts, review spacing, or mastery. A later supervised or ordinary online question is a separate instance and separate evidence. This prevents downloading an answer key and submitting its IDs for independent credit.

At most two currently eligible packs and four total issuances per rolling 24 hours are permitted per learner. Prior invalid consent/grant leases do not consume the active limit, but issuance history counts toward the daily bound. API rate limits also apply. These bounds are not a substitute for production load testing or account-wide abuse controls.

## Storage and operations

The migration adds immutable pack, original, attempt, and receipt tables, plus authorization revision triggers. Parent streaming exports include offline originals, provisional responses, and receipts; opaque installation bindings are omitted. Learner/account learning-data deletion purges the offline tables even when a financial learner tombstone is retained. The existing `privacy:retention` job deletes expired packs and their dependent records after a 30-day recovery/export window. Operators must schedule that job.

Configuration requires all of:

- `AMP_OFFLINE_PACKS=enabled`
- `AMP_OFFLINE_PRIVATE_KEY_FILE` and `AMP_OFFLINE_PUBLIC_KEY_FILE`: matching Ed25519 PKCS#8 and SPKI PEM files, provisioned through approved secret storage.
- `AMP_OFFLINE_KEY_ID`: an opaque deployment key identifier.
- `AMP_OFFLINE_SERVICE_ID`: the exact canonical HTTPS identifier for this AMP service.
- `AMP_OFFLINE_ACCOUNT_BINDING_KEY`: a separately provisioned 32-byte secret encoded as standard padded base64.

There are no default keys or automatic key generation. Private signing keys and binding secrets must never enter the repository, logs, browser bundles, manifests, or support exports. Production rollout requires trusted native public-key provisioning, secure device persistence and account switching, queue recovery, real provider/device session acceptance, and explicit offline learner/parent UX. Automated server fixtures do not establish those device capabilities.
