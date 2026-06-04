# World Plaza — Production Multiplayer (P1)

**Status:** Design + sequenced plan. NO source changes here — this is the spec the
implementation fans out from. It hardens the proven two-window presence spike
(`server/*` + `src/net/*`, `docs/MULTIPLAYER.md`) into a **real, safe, scalable**
launch system, and assigns each piece to a phase.

**Author intent in one line:** turn "two windows see each other walk" into "a
lively plaza of strangers who can safely duel + mediated-chat in their own target
language, that scales horizontally, survives flaky mobile networks, and cannot be
cheated or weaponized against a child."

**Non-negotiable bar (inherited):** no login, no PII, age-3+ safe; on-device-first
privacy; the **Room is shared + Track-agnostic, the (native,target) pair is
PERSONAL and never broadcast as gameplay state**; the server NEVER forwards raw
user text; localize every new string; best-effort presence never crashes
single-player; data/CDN-driven where possible. Infra (AWS/Terraform/containers) is
owned by `docs/INFRA_DEPLOY.md` — this doc references its targets, it does not
design them.

---

## 0. Built vs. needed (honest inventory)

What exists and is proven (do not regress):

| Built | Where |
|---|---|
| Authoritative Colyseus `PlazaRoom`, schema-synced `players` map | `server/src/PlazaRoom.ts`, `state.ts` |
| Movement validation: stale-`seq` drop, bounds clamp, **anti-teleport speed cap on server wall-clock dt** | `PlazaRoom.applyMove` |
| `allowReconnection(client, 20)` graceful drop window | `PlazaRoom.onLeave` |
| `joinOrCreate` + `sortBy({clients:-1})` fill-then-spin, `enableRealtimeListing()` | `server/src/index.ts` |
| Single shared topology loaded once from pack content; bounds/spawns identical client+server | `index.ts` (`plaza-grand.json`) |
| Client presence: best-effort connect, ~10Hz move broadcast, **entity interpolation ~120ms in the past**, remote-avatar lifecycle, silent degrade-to-solo | `src/net/netClient.ts`, `remoteAvatar.ts` |
| Presence payload already carries `sceneId`/`questId` (skin) but **NOT** native/target | `state.ts`, `netClient.ts` |
| Typed safety contracts: `MediatedChatInput`/`MediatedChatArtifact`/`ModerationDecision`, `InteractionRequest/Response`, `EconomyTransaction.sig`, `OfflineProgressEvent` | `contracts/src/{chat,interaction,economy,sync}.ts` |

What is **needed** for production (this doc designs all of it):

1. **Room lifecycle + matchmaking + a room directory** — today it's "join the
   most-full plaza, spin a sibling at 30." That is occupancy-only on ONE topology
   with no novelty, no freshness, no drain, no directory the client can browse.
2. **The invariant enforced under load** — today it's an accident of the schema
   not having a pair field. Production must make it a *structural guarantee* with a
   test and a clear presence payload spec.
3. **Reliability** — reconnection exists but with no presence-token resume, no TTL
   sweep, **no rate limits** (a client can flood `move`/future `chat`), and only
   movement anti-cheat. Economy/trade anti-cheat is contracted but unimplemented
   server-side.
4. **Mediated-chat routing safety** — only a *seam* exists; no `onMessage("chat")`
   handler, no moderation, no audit log.
5. **Horizontal scale** — single process, in-memory matchmaking, no Redis presence
   driver, no shared room directory, no deploy shape.

---

## 1. Room lifecycle + matchmaking + the room directory

### 1.1 The room as a "place," not a slot

Today `PlazaRoom` is a generic seat pool on one hard-coded topology. Production
introduces **`RoomFlavor`** — server metadata attached at `define`/`create` so
matchmaking and the directory can reason about *what kind of place* a room is.
The data-driven `RoomTopology` variety (the topology generator, `CONTENT_SCALE`
Slice 4c) is the input: each generated topology has an id, a size, a
`topologyVariant` tag (e.g. `plaza-grand`, `market-row`, `harbor-steps`,
`walled-town`), and anchor mix. A room is `(topologyVariant, instanceN)`.

```ts
// server/src/roomFlavor.ts (NEW) — server-only, NOT a wire contract
interface RoomFlavor {
  topologyId: RoomId              // which RoomTopology this room renders/collides on
  topologyVariant: string         // "plaza-grand" | "market-row" | … (directory facet)
  capacity: number                // hard maxClients for THIS room (band-derived, §1.2)
  cohortId: string                // rotation bucket (§1.4) — novelty without churn
  createdAt: number               // for freshness + drain age
  region: string                  // deploy region tag (directory facet; INFRA owns regions)
}
```

`PlazaRoom.onCreate(options)` already takes a `topology`; it gains
`flavor: RoomFlavor` and `setMetadata(flavor)` so `enableRealtimeListing()` (and
the directory in §1.5) expose it. Metadata is the ONLY thing the directory reads —
it never touches per-player state.

### 1.2 Occupancy bands ("lively but not full")

A plaza with 1 person is lonely; a plaza jammed to the cap feels like a mosh pit
and stresses the patch-rate. Matchmaking targets a **comfort band**, not "max
fill." Per topology size:

```ts
// derived from topology footprint (area / target density), clamped:
interface OccupancyBand {
  min: number        // below this, the room is "quiet" — prefer to backfill it
  target: number     // the sweet spot matchmaking aims to hold (the "lively" mark)
  soft: number       // above this, stop routing new joins here (still joinable by friends)
  hard: number       // PlazaRoom.maxClients — absolute cap (reservation refused)
}
// plaza-grand example: { min: 3, target: 12, soft: 18, hard: 24 }
```

Bands replace the blunt `maxClients = 30`. The default `plaza-grand` band is
`{3, 12, 18, 24}` — 24 is the patch-rate-comfortable hard cap (24 players ×
~6 schema-leaf updates × patch rate is well within a single room's CPU; see §5.3).
Bands are **data** (per `topologyVariant`), so a small `market-row` can be
`{2, 6, 10, 14}` and a grand plaza larger — no code fork.

### 1.3 The matchmaking ranking (replaces bare `sortBy`)

`gameServer.define("plaza", …).filterBy([...]).sortBy({...})` cannot express
"lively-but-not-full + fresh-for-this-user." Production uses a **custom
matchmaking function** (Colyseus `defineRoomType` + a `joinOrCreate` wrapper, or
the matchmaker `onJoin` hook). The client calls a thin `matchmake` API (§1.5) that
ranks candidate rooms by a scalar score:

```
score(room, user) =
    bandFit(room.occupancy, room.band)          // peak at `target`; steep penalty past `soft`
  + freshness(room, user)                        // NEGATIVE if user was just in this cohort (§1.4)
  + languageMixBonus(room, user)                 // soft: a few same-target peers = better chat odds (§2.4)
  + variantNovelty(room, user)                   // mild bonus for a topologyVariant the user hasn't seen lately
  - drainPenalty(room)                           // rooms marked draining (§1.6) score to −∞
```

- `bandFit` is the core: a triangular preference peaking at `target`, falling to 0
  at `min` and at `soft`, and hard-excluding past `hard`. This naturally **backfills
  quiet rooms before opening new ones** AND **stops cramming a near-full room** —
  the band, not raw `clients:-1`, decides.
- If NO room scores above a floor (all full or all draining), the matchmaker
  **creates a fresh room** of the most under-served `topologyVariant` (round-robins
  variety so the world isn't all identical plazas).

`languageMixBonus` is the ONLY place target-language touches matchmaking, and it is
a **soft, anonymized hint** computed without ever exposing a pair (§2.4) — purely
to raise the odds that mediated chat has a willing same-target partner. It is never
a *filter*: a `sw:zh` player still lands in a lively plaza, just without a same-pair
nudge.

### 1.4 Cohort rotation (novelty without churn)

A user who plays daily should not see the exact same faces every session (and a
bored room should refresh). Each room carries a `cohortId` (a rotating bucket id
that advances every `COHORT_WINDOW` ≈ 30 min, or when a room recycles). `freshness`
gives a **negative** score to a room whose `cohortId` the user was *just* in, so
re-joins drift the user toward a different cohort → new strangers — **without**
yanking anyone out of a live room. Rotation is a *placement bias on the next join*,
not a forced reshuffle (forced reshuffles are a dark pattern and break in-progress
duels). Stored client-side only: a tiny `wp:mp:lastCohorts` ring (last ~4 cohortIds,
localStorage, ≤200 bytes) — no server memory of the user, privacy-clean.

### 1.5 The room directory service

`enableRealtimeListing()` already publishes live room metadata. Production wraps it
in a **directory** the client can both *auto-matchmake* against and *browse*:

```ts
// the wire shape the directory returns (NEW contract: contracts/src/directory.ts)
const RoomDirectoryEntry = z.object({
  roomId: z.string().min(1),            // Colyseus room id (opaque seat-reservation target)
  topologyId: RoomId,
  topologyVariant: z.string(),
  occupancy: z.number().int().nonnegative(),
  band: z.object({ target: z.number().int(), soft: z.number().int(), hard: z.number().int() }),
  // anonymized language MIX — counts only, NEVER pairs, NEVER per-player (§2.4):
  targetMix: z.record(z.string(), z.number().int()),  // { "es": 4, "fr": 2 } — target-lang head-counts
  freshness: z.number(),                // server-stamped; client combines with its lastCohorts
  region: z.string(),
})
const RoomDirectory = z.object({ rooms: z.array(RoomDirectoryEntry), serverTime: z.number() })
```

Two consumers:
- **Smart onboarding placement (auto):** the default path. The client asks the
  matchmaker for "a good plaza for me" (it sends only its anon `playerId`, its
  `lastCohorts` ring, and its target-language *hint* — see §2.4); the server runs
  §1.3 and returns a seat reservation. The user never sees a list.
- **Browse (optional, premium nicety):** a "Plazas" sheet in the menu shows the
  directory (variant, a "lively/quiet/busy" pip from the band, an anonymized
  `targetMix` glance like "mostly Spanish learners here"). Tapping one joins it.
  This is opt-in browsing, not a lobby the user is forced through.

The directory entry exposes **no displayName, no position, no pair** — only
aggregate counts and room metadata. It is the same privacy-clean surface
`ANALYTICS_PULSE` reads.

### 1.6 Graceful drain / recycle

Rooms must recycle for deploys and to retire stale/empty rooms:
- **Empty-room reap:** a room at occupancy 0 for `EMPTY_TTL` (≈60s) disposes
  itself (Colyseus `autoDispose` is true by default; production keeps it but adds a
  log + metric). Reservations created in the empty window keep it alive.
- **Drain on deploy:** the server exposes an admin signal (SIGTERM-driven, already
  wired to `gracefullyShutdown`) that first marks every room `draining=true`
  (`drainPenalty → −∞`, so no NEW joins route there) and **lets in-progress duels
  finish** within a grace window before disconnecting; clients receive a soft
  `room.onLeave(code)` and the best-effort reconnect/rematchmake path (§3.1) lands
  them in a fresh room. Players never see an abrupt kick mid-duel unless the grace
  window lapses.
- **Recycle for novelty:** a long-lived room whose cohort has fully turned over can
  self-recycle (mark draining, let it empty, dispose) so cohortIds keep advancing —
  a slow background refresh, never a forced one.

---

## 2. The hard invariant under load (Track-personal, Room-shared)

### 2.1 The structural guarantee

**Invariant (non-negotiable): rooms are SHARED + Track-agnostic; the
(native,target) pair is PERSONAL and NEVER broadcast as gameplay state; remotes
render skinned into the VIEWER's Track.** Today this holds *by accident* — the
schema simply has no pair field. Production makes it a **structural guarantee**:

- There is **no `native`/`target`/`trackId` field anywhere in `PlazaState` or
  `PlayerState`**, and there never will be. A contracts conformance test
  (`contracts/test`) asserts the presence schema's key set is exactly
  `{playerId, name, avatar, x, z, facing, sceneId, questId, t}` — adding a pair
  field fails CI. This is the enforcement: the pair *cannot* leak because the wire
  shape *cannot carry it*.
- Matchmaking **ignores Track entirely** for routing decisions (only the §2.4
  anonymized aggregate hint exists, and it is counts-only, never a per-player
  pair). A conformance test asserts two clients with *different* pairs (`en:es` and
  `fr:de`) joining the same plaza share one room and collide in the same geometry.

### 2.2 The presence payload (exact)

What each client broadcasts (derived from its **active Track**, per
`LANGUAGE_PAIR_STATE` §5.2):

| Field | Source | Why it's safe |
|---|---|---|
| `playerId` | global `wp:player:id` (one per device, anon) | Stable anon id, no PII, not a login |
| `name` | `activeTrack.state.identity.displayName` (per-Track composed-safe persona) | A generated persona ("Brave Marigold"), never user-typed PII |
| `avatar` | `activeTrack.state.avatar` (JSON leaf, set at join, never on hot-path) | Paper-doll layers; re-skinned by viewer |
| `sceneId` | `activeTrack.state.activeSceneId` | A *skin* selector, not the pair (Tokyo-skin ≠ "French") |
| `questId` | `activeTrack.state.activeQuestId` | Frames the *viewer's* chat artifact, not a pair |
| `x,z,facing,t` | authoritative position | Movement only |

`native`/`target` are **NOT** broadcast. The pair appears on the wire only
*implicitly* via `sceneId`/`questId` (which are skins, and a scene can host many
pairs). The remote client renders the incoming `avatar`/`name` **skinned into ITS
OWN Track's wardrobe theme** — exactly what `createRemoteAvatar(scene, { theme })`
already does. So a player sees every stranger dressed for *their* world; the
stranger's private pair is structurally invisible.

### 2.3 Mid-session Track switch reflection (the one additive server touch)

When a player switches Track mid-session (`LANGUAGE_PAIR_STATE` §5.4) only their
*skin* changes. Add a tiny additive handler alongside `"move"`:

```ts
this.onMessage("presence", (client, raw) => {
  const p = PresenceUpdate.safeParse(raw)   // { name?, avatar?, sceneId?, questId? } — NO pair fields
  if (!p.success) return
  const me = this.state.players.get(client.sessionId); if (!me) return
  if (p.data.name)    me.name   = sanitizeName(p.data.name)
  if (p.data.avatar)  me.avatar = serializeAvatar(p.data.avatar)   // reuse existing validators
  if (p.data.sceneId !== undefined) me.sceneId = String(p.data.sceneId)
  if (p.data.questId !== undefined) me.questId = String(p.data.questId)
})
```

The `PresenceUpdate` contract **deliberately has no pair fields** (same conformance
guard as §2.1). The handler can only touch the *sender's own* leaf — there is
structurally no shared "current pair" field to corrupt. Old servers without this
handler degrade to "remotes see your old skin until your next move broadcast" —
best-effort, never blocking.

### 2.4 The anonymized language-mix hint (matchmaking, never a broadcast)

To make mediated chat *likely to have a partner* without leaking pairs:
- On a matchmake request the client sends its **target** code only (e.g. `"es"`) as
  a transient **routing hint** — not stored, not written into room state, not
  forwarded to any other client. The server uses it ONLY to compute
  `languageMixBonus` (§1.3) and to maintain a room's aggregate `targetMix` head-count.
- `targetMix` in the directory is **counts by target code** (`{ "es": 4 }`), never
  tied to a `playerId`, never the *pair* (native is never in the hint at all). With
  ≥`k` (e.g. 3) the count is shown; below `k` it's bucketed to "a few" so a single
  rare-target player can't be singled out (k-anonymity for the long tail).
- This is the ONLY place target-language influences the server, it is a *soft bias*
  not a filter, and it is reconciled with the privacy posture: aggregate, k-anon,
  transient, opt-outable (a user can disable the hint → pure occupancy matchmaking).

---

## 3. Reliability

### 3.1 Reconnect (resume, not just hold)

Today `allowReconnection(client, 20)` *holds* a dropped avatar for 20s but the
client doesn't actually resume — `netClient.onLeave` clears remotes and marks
`reconnecting` with no rejoin. Production closes the loop:

- **Server:** keep `allowReconnection`, but issue a **reconnection token** to the
  client at join (Colyseus `client.reconnectionToken`). Widen the window to
  `RECONNECT_TTL` ≈ 45s (mobile background/lock-screen + tunnel hops need more than
  20s; capped so a truly-gone player is reaped).
- **Client:** on a non-consented `onLeave`, `netClient` attempts
  `client.reconnect(token)` with **capped exponential backoff** (e.g. 0.5/1/2/4s,
  ≤3 tries) BEFORE falling back to a fresh `matchmake` (§1.5). Status flows
  `online → reconnecting → (online | offline-solo)`; the world keeps running solo
  the entire time. On successful resume the avatar never left the room → zero pop.
- **Backgrounding:** when the app backgrounds (host signals it), the client sends a
  consented-style "pause" so the server holds the seat for the TTL instead of
  treating it as a flap; on foreground it resumes the token first.

### 3.2 Presence TTL + flap protection

- **Heartbeat TTL:** the transport's ping/pong already detects dead sockets; add a
  server-side **last-message TTL** — a player who sends no `move`/`presence`/pong
  for `IDLE_TTL` (≈90s) is soft-removed (they're likely a zombied tab). Cheaper
  than waiting for TCP timeout and keeps `targetMix`/occupancy honest.
- **Join-flap guard:** a `playerId` that joins+leaves repeatedly in a short window
  is rate-limited at the matchmaker (a short cooldown), preventing reservation
  churn from a crash-looping client or a griefer.

### 3.3 Rate limits (per-session token buckets)

There are **none today** — a client can spam any `onMessage`. Production adds a
per-session token-bucket limiter (a tiny `server/src/rateLimit.ts`, no deps),
checked at the top of each handler; over-budget messages are **dropped + counted**
(noisy: warn + a per-session `dropped` metric), and a session that sustains abuse
is disconnected:

| Message | Budget | Rationale |
|---|---|---|
| `move` | ~15/s (sustained), burst 30 | Client sends ~10Hz; headroom for jitter, cap stops floods |
| `presence` | ~1/s, burst 3 | Track switches are rare; this is not a hot-path |
| `chat` (§4) | ~1 / 2s, burst 2 | Conversational cadence; throttles spam + caps LLM-route cost |
| `interaction` (duel req/resp) | ~1 / 3s, burst 2 | Stops duel-request spam / harassment |
| `trade` (§3.5) | ~1 / 5s, burst 1 | Trades are deliberate; tight cap aids wash-trade defense |

Buckets are per-`sessionId`, reset on leave. Limits are constants (tunable), not
content — they ship in the server.

### 3.4 Authoritative position validation (basic anti-cheat) — already strong, harden

`applyMove` already: drops stale `seq`, clamps to topology bounds, and caps
displacement by `MAX_SPEED × server-wall-clock dt` (so a forged `t` can't forge dt).
Production adds:
- **Blocker collision on the server.** Today bounds are enforced but `blockers`
  (the topology's collision footprints) are not — a cheater could clip through a
  wall. Add a server-side blocker test in `applyMove`: if the clamped step lands
  inside a blocker AABB, reject the lateral component (slide along, same as the
  client collision) so the authoritative position respects collision too. The
  topology is already loaded server-side; this reuses its `blockers`.
- **Spawn authority** is already server-owned (round-robin). Keep it.
- **Sanity caps:** reject non-finite/NaN positions (zod already enforces `number`;
  add an `isFinite` guard before write). Per-session a sustained stream of
  speed-capped (i.e. cheating) moves trips a soft flag → tighter rate limit.

This is "basic anti-cheat" by design — presence is cosmetic-ish (movement grants no
reward), so the bar is "no teleport, no wall-clip, no flood," not full server
physics. The *valuable* anti-cheat is on economy/XP (§3.5), which IS reward-bearing.

### 3.5 Economy / trade / XP anti-cheat (the reward-bearing surface)

The contracts already anticipate this (`EconomyTransaction.sig`,
`OfflineProgressEvent.sig`, `SyncEvent` reconcile, `ECONOMY_CURRENCY` §3.4/§7
wash/velocity caps). Production implements the **server side** of it. Note: economy
durability/settlement is the durable-API server's job (Fastify + Postgres per
`INFRA_DEPLOY`), NOT the realtime Colyseus room — but player↔player *trade
proposals* route through the room, so the room enforces the realtime guards and the
durable API does the authoritative settlement:

- **Offline-signed reconcile.** A device queues `OfflineProgressEvent`s
  (challenge results, XP, economy txns) signed with an HMAC. On reconnect the client
  pushes them (`SyncEvent.pushProgress`); the **durable API** verifies each `sig`,
  re-derives rewards deterministically from the seeded `RewardTable`
  (`ECONOMY_CURRENCY` §7.1 — reproducible), and **rejects implausible ones**
  (returns `reconciled { inventory, levelState, rejected[] }`). The client never
  self-grants authoritatively; offline play is provisional until reconciled.
- **Trade routing (room) + settlement (API).** A player↔player exchange is a typed
  `trade` proposal over the room (NOT raw); the room validates lopsidedness
  (`validateProposal`'s `>8×` guard), applies the **per-pair, per-window velocity
  cap** (two accounts can't ping-pong currency to mint value or time the price
  feed), then hands the agreed atomic swap to the durable API to settle against both
  wallets. Integer minor-units only (no float drift; exact HMAC hashing).
- **Wash/velocity caps** (`ECONOMY_CURRENCY` §3.4): per-pair per-window trade-volume
  cap + price-feed rate-of-change clamp + impact caps, all server-side. A fair swap
  mints no value anyway; the caps stop feed-timing exploits and protect a child from
  being talked out of their inventory at speed.
- **Duel result reconcile.** A `duel` (§6 phase) result is a `ChallengeResult` from
  EACH client; the room/ API cross-checks the two reports, takes the
  signed/agreeing result, and only then grants XP — a client can't unilaterally
  claim a win.

---

## 4. Mediated-chat routing safety (safety-by-architecture)

### 4.1 The posture: the server NEVER forwards raw user text

The contracts already encode this (`chat.ts`): a sender's device **cleans →
moderates → translates → "lessonifies"** its line into a typed `MediatedChatInput`
*before it ever hits the wire*; the recipient receives a `MediatedChatArtifact` (a
language lesson), **not necessarily the original message**. Production adds the
missing server middle: an `onMessage("chat")` handler that **validates, moderates,
audits, and routes** — and that **never echoes a raw string field** to anyone.

### 4.2 The server chat handler (exact flow)

```
client A → room.send("chat", MediatedChatInput {from, to, interactionId,
                       source, sourceLanguage, targetLanguage, mode})
   │   (source is text/speech-transcript/phraseCard — already device-pre-cleaned)
   ▼
PlazaRoom.onMessage("chat"):
  1. rate-limit (§3.3 chat bucket); over-budget → drop+count.
  2. MediatedChatInput.safeParse → reject malformed (noisy warn).
  3. AUTHZ: `from === client's own playerId` (can't spoof another sender);
            `to` is a CURRENT co-occupant of THIS room (can't DM across rooms).
  4. consent gate: a `chat` requires a prior accepted `chatOpen`
     (interaction.ts InteractionRequest/Response) between A and B — no
     unsolicited messages to strangers who didn't opt in (anti-harassment, age-safe).
  5. SERVER-SIDE MODERATION pass over the structured source (NOT a passthrough):
       • PII/lure scrub: regex+heuristic strip of emails/phones/URLs/handles/
         "what's your name/age/where do you live" lure patterns → ModerationDecision.
       • safety classifier (on-device-class model or a small server classifier):
         decision ∈ {allow, transform, block}; reasons ∈ {pii,link,abuse,nonsense,lowconf}.
       • block → emit NOTHING to the recipient (sender gets a soft "couldn't send"
         artifact); transform → softened; allow → proceed.
  6. AUDIT: append an audit record (interactionId, from, to, decision, reasons,
     confidence, t) to a moderation log — NO raw text retained beyond a short
     forensic TTL, hashed where possible (§4.4).
  7. ROUTE: build a per-recipient MediatedChatArtifact framed by the RECIPIENT's
     quest/level (the recipient's device does final lessonify on receipt; the
     server forwards the typed, moderated artifact — never the raw `source.text`).
   ▼
client B ← room.send("chat", MediatedChatArtifact { visibleText, learnerText?,
                       transliteration?, gloss?, suggestedReplies[], lessonNotes[],
                       moderation, safetyClass })
```

The handler emits a `MediatedChatArtifact` (the contract's recipient shape), which
**has no raw-source field** — `visibleText`/`learnerText` are the moderated,
translated, lessonified outputs. There is structurally no path for A's literal
keystrokes to reach B.

### 4.3 Why this is age-3+ safe

- **No raw UGC ever transits the server to another child.** Even text that passes
  moderation arrives as a *translated lesson artifact*, not a verbatim string.
- **Consent-gated:** no messages without a mutually accepted `chatOpen`.
- **PII/lure scrubbing is server-authoritative** (a malicious client that skips its
  device-side clean still gets scrubbed at the server — defense in depth).
- **Suggested-reply rails:** beginners reply via `suggestedReplies` (curated corpus
  phrases) rather than free text, so the most common path is *fully canned* —
  pre-translated, pre-moderated content, zero free-text risk.
- **Block is silent to the target** (the recipient never sees a blocked attempt),
  so moderation can't be used to harass by proxy.

### 4.4 Audit + privacy reconciliation

- Audit log records **decisions + structured reasons + interactionId + anon
  playerIds + timestamp** — the signal needed to spot abuse patterns and tune
  moderation. Raw source text is **not** persisted past a short forensic window and
  is **hashed/redacted** in the durable record (you can prove "this player was
  repeatedly blocked for lure patterns" without storing what they said).
- This is the one place a tiny server-side record about interactions exists; it is
  the minimum for safety, contains no PII (anon ids only), is aggregate-friendly,
  and is owner-disclosed in the compliance doc (P6). It does NOT contradict
  "on-device analytics only" — it is *safety moderation state*, not product
  analytics, and it stores no message content.

---

## 5. Scale + deploy shape

> Infra-as-code (Terraform, AWS service choices, networking) is `INFRA_DEPLOY`'s
> job. This section specifies what the *application* needs from it and the load
> shape, so the two docs meet at a clean seam.

### 5.1 Horizontal scale with Redis (the presence/matchmaking driver)

A single Colyseus process is the spike. For launch, run **N stateless Colyseus
nodes behind the managed realtime endpoint**, coordinated by **managed Redis**:
- **`RedisPresence` + `RedisDriver`** (Colyseus' built-in scale primitives): the
  room registry (which rooms exist, on which node, their metadata) lives in Redis,
  so `enableRealtimeListing()` / the directory (§1.5) and the matchmaker see **all
  rooms across all nodes**, not just the local process. A reservation on node X is
  honored even if the matchmake request hit node Y.
- **Sticky by reservation, not by user.** Colyseus seat reservations already bind a
  client to the node hosting its room for the socket's life; the LB must honor the
  reservation (WebSocket affinity). No user session is pinned beyond the room.
- **Room directory is Redis-backed**, so it's the cross-node truth and the §2.4
  `targetMix` aggregates are global, not per-node.

### 5.2 The two server tiers (clean separation)

| Tier | Role | State | Scale |
|---|---|---|---|
| **Realtime (Colyseus + Redis)** | presence, movement, room lifecycle, matchmaking, mediated-chat routing, duel/trade *routing* + realtime guards | ephemeral (rooms in memory, registry in Redis) | horizontal, stateless nodes |
| **Durable API (Fastify + Postgres)** | offline-signed reconcile, authoritative wallet/XP settlement, the moderation audit log, catalog/content | durable | independent of room count |

The realtime tier is **Track-agnostic** (§2) so it never multiplies by the 2,450
language pairs — it shards by *population on topologies*, full stop. The durable
tier holds the reward-bearing truth (anti-cheat settlement, §3.5).

### 5.3 Load shape (sizing math)

- **Per room:** ≤24 players (`hard` band), each emitting ~10Hz `move`. The room
  validates ≤240 moves/s and the framework encodes binary deltas at the patch rate
  (~20Hz) to ≤24 clients. Per-player schema leaf is tiny (a few numbers + an
  unchanging avatar JSON). This is comfortably a fraction of one core per room.
- **Per node:** a node hosts many rooms; the binding constraint is socket count +
  patch-encoding CPU, not Track variety. Target a conservative rooms-per-node
  budget (e.g. tens of rooms / low-thousands of concurrent sockets per node) and
  scale nodes horizontally on connection count — `INFRA_DEPLOY` sets the
  autoscale signal (CPU + socket count) and the per-region node pool.
- **Matchmaking cost** is a Redis lookup + a small ranking pass over candidate
  rooms (filtered by region + variant), not a global scan.
- **Chat/duel/trade** are low-frequency (rate-limited to ~conversational cadence),
  so their CPU is negligible vs. movement; the LLM lessonify cost is **on-device**
  (sender + recipient), not server, so it doesn't scale with server fleet.

### 5.4 Deploy topology (reference — INFRA owns the IaC)

- Stateless **Colyseus containers** (one image, env-configured port/region/Redis
  URL), autoscaled on connection count, behind a WebSocket-aware load balancer with
  `wss://` (TLS). `SIGTERM` → graceful drain (§1.6).
- **Managed Redis** (presence/driver/directory + targetMix aggregates).
- **Durable API containers** (Fastify) + **managed Postgres** (wallets, XP, audit
  log).
- **CloudFront/CDN** for the catalog + scene/theme/asset packs (mirrors the existing
  posture); signed URLs for any Plus-gated content. The realtime endpoint is a
  separate `wss://` hostname.
- Config the client reads via `VITE_WP_MULTIPLAYER_URL` (build) or a host setting
  (runtime) — already the opt-in seam; production points it at the prod `wss://`
  endpoint and degrades to solo if unreachable.

---

## 6. Phased plan

Sequenced so each phase is shippable and verifiable in the REAL embedded app (the
standalone-vs-embedded trap), against the frozen contracts; the orchestrator
serializes `game.ts`/server-integration. Commit/push stays the owner's
(`feedback_git_workflow`).

### Phase MP-0 — MVP: one lively world, real synced remotes, resilient
The shippable core. **One world**, 2–3 `topologyVariant`s from the generator,
**occupancy-band matchmaking** (§1.2–§1.3, single node OK), **visible synced
remotes** (already proven — wire `createNetClient` into `game.ts` per
`MULTIPLAYER.md` §3), and **reconnect that actually resumes** (§3.1) + presence TTL
(§3.2) + the move/presence **rate limits** (§3.3) + **server blocker collision**
(§3.4). Add the additive `"presence"` handler (§2.3) and the §2.1 conformance test
(no pair field; two different-pair clients share a room).
- **Server:** `roomFlavor.ts`, `rateLimit.ts`, band-aware matchmaking, blocker
  collision, reconnection token, `"presence"` handler.
- **Client:** `netClient` reconnect/backoff + status surface; wire into `game.ts`.
- **Contracts (additive):** `directory.ts` (`RoomDirectoryEntry`/`RoomDirectory`),
  `PresenceUpdate` (no pair fields); bump `CONTRACTS_VERSION` additively.
- **Exit:** in the real app on phone+tablet+desktop, two devices see each other
  walk in a band-managed plaza; background one → it resumes without popping;
  flood-test `move` → throttled, world stable; conformance test green.

### Phase MP-1 — Duels (typed, reconciled)
The first cross-player *interaction*. Wire `InteractionRequest/Response`
(`chatOpen`/`challenge`) through the room with consent + rate limits; run the duel
locally on each client (`ChallengeMode "duel"`); **cross-check the two
`ChallengeResult`s** and grant XP only on the agreeing/signed result (§3.5). Drain
(§1.6) lets in-progress duels finish.
- **Exit:** two real players accept a duel, play it, and only the verified result
  grants XP; spam duel-requests are rate-limited.

### Phase MP-2 — Mediated chat (safety-by-architecture)
Implement the §4 `onMessage("chat")` handler end to end: consent gate
(`chatOpen`), server moderation (PII/lure scrub + classifier → `ModerationDecision`),
audit log, and per-recipient `MediatedChatArtifact` routing — **never raw text**.
Suggested-reply rails for beginners. Surface the line on the `RemoteAvatar`'s
existing `talk()` channel.
- **Exit:** two players "chat"; the recipient receives a translated lesson artifact
  framed by *their* quest, PII is scrubbed server-side, a blocked message reaches no
  one, the audit log records decisions (no raw content); age-safe review passes.

### Phase MP-3 — Scale-out (Redis + directory + deploy)
Switch to `RedisPresence`/`RedisDriver`; make the **room directory** (§1.5)
cross-node + Redis-backed; add **cohort rotation** (§1.4), the anonymized
`targetMix` hint (§2.4, k-anon), browse-Plazas sheet (optional), and graceful
drain on deploy (§1.6). Stand up the **two-tier deploy** (§5.2/§5.4) and wire the
economy/trade reconcile to the durable API (§3.5). Coordinate AWS targets with
`INFRA_DEPLOY`.
- **Exit:** N nodes behind the prod `wss://` endpoint share one directory;
  matchmaking lands users in lively, fresh, novel rooms across the fleet; a deploy
  drains without kicking mid-duel; economy reconcile rejects forged offline events;
  load test holds the band targets.

---

## 7. Cross-cutting requirements (every phase)

- **The invariant is structural, not incidental** — no pair field on the wire,
  conformance-tested; matchmaking Track-blind except the §2.4 k-anon aggregate hint.
- **No raw UGC server→child, ever** — chat is typed-artifact-only, consent-gated,
  server-moderated, audited without retaining content.
- **No login / no PII** — anon `playerId`, generated personas; the only server-side
  per-interaction record is the safety audit (anon ids, no content), owner-disclosed.
- **Best-effort presence** — every net path degrades to solo, noisy-not-silent; the
  world never crashes on a server/network failure.
- **Noisy errors / rate-limit drops are counted + logged**, never silent.
- **Localize every new string** (~50 langs) — directory/browse/reconnect/chat UI.
- **Tablet + desktop + phone first-class** — every new surface (browse sheet, chat,
  duel prompt) mounts in `.wp-overlay`, safe-area aware, touch+pointer+ESC.
- **Verify in the REAL embedded app** at each phase, not standalone alone.
- **Infra is `INFRA_DEPLOY`'s** — this doc references AWS targets (Colyseus
  containers + managed Redis/Postgres + CloudFront) and the load shape; it does not
  author the IaC.

---

## 8. Open questions for the owner

1. **Browse-Plazas sheet:** ship the optional directory-browse UI (§1.5) at launch,
   or auto-matchmake only (no lobby) and add browse later? Recommend auto-only for
   MP-0, browse in MP-3.
2. **`targetMix` hint default:** opt-in or opt-out? Recommend **on by default**
   (it only raises chat-partner odds, is k-anon + transient) with a clean toggle.
3. **Reconnect TTL vs. seat cost:** 45s default (§3.1) — confirm vs. a longer
   mobile-friendly hold (trade-off: a longer hold keeps a ghost seat occupying band
   capacity longer).
4. **Moderation classifier location:** on-device-class model invoked server-side vs.
   a dedicated small server classifier (§4.2 step 5). Recommend server-side
   classifier for authority (a malicious client can't bypass it) with on-device
   pre-clean as defense-in-depth.
5. **Duel XP authority:** cross-checked dual-report (§3.5) for MP-1, or defer
   reward-bearing duels until the durable API exists (MP-3)? Recommend cosmetic/no-
   reward duels in MP-1, reward-bearing after reconcile lands.
