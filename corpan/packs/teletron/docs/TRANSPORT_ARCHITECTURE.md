# Teletron Transport Architecture — Gold-Standard Target & Review Checklist

> **Status:** design study (read-only). This is the target the concurrent fix
> must converge on, and the checklist the CTO runs against the implementer's
> diff. It does not describe the current code as correct — it describes what
> correct looks like and pins exactly where today's code diverges.
>
> **The product promise this must keep:** *a message sent at 2 pm to an offline
> friend arrives when they open the app at 8 pm* — across an empty room, a
> server restart, and a deploy. Everything below is in service of that one
> sentence plus "two people in the same room can actually talk."

---

## 0. The three production failures, mapped to root cause

| # | Symptom (owner-confirmed) | Root cause in current code | Layer |
|---|---|---|---|
| 1 | Both peers online, same room → **zero** messages either way | (a) Two windows/devices on one install **share `localStorage["teletron.playerId"]`** → identical `playerId` → server `replaceDuplicatePlayerId` evicts one → they are never *both* present, so the accepted-pair guard rejects every `chat-send`. (b) `chat-send` is **silently dropped** when `acceptedPairForPlayerIds` is false; there is no NACK, so the client shows the message as sent. | Identity + routing |
| 2 | Offline-sent messages **never** delivered on return | The outbox is `createMemoryOutbox()` — **pure process memory**. Colyseus rooms dispose when empty and the single EC2 container restarts on every deploy/crash. At 8 pm the 2 pm envelope is gone. Worse: `acceptedPairs` is *also* in-memory, so after a restart the sender's next `chat-send` is rejected and the message is never even **enqueued**. The 24 h TTL is fiction on top of a store that doesn't survive 24 minutes of idle. | Durability |
| 3 | Re-entering a conversation corrupts state / can't get back in | Rejoin can leave `byPlayerId[playerId]` pointing at a **dead/old sessionId** (reconnection grace holds the seat; a parallel fresh-join overwrites/half-overwrites the index), so live routing targets a corpse. The client's `restoredConversation`/`hydrateInbox` one-shot guard + `players.clear()` on every `bindRoom` can also wipe a just-revived conversation. | Lifecycle |

The rest of this document specifies the correct model for each.

---

## 1. Identity model

Three distinct identifiers exist. **They must never be conflated**, and exactly
one is authoritative for each job.

### 1.1 The three identifiers

| Identifier | Lifetime | Scope | Source |
|---|---|---|---|
| **`playerId`** (`teletron-<uuid>`) | Durable per **install** | Global, cross-room, cross-restart | `localStorage["teletron.playerId"]` (client-minted) |
| **Colyseus `sessionId`** | One **socket** (one seat) | Single room process; dies on real leave | Server-minted per connection |
| **`reconnectionToken`** | One reconnection grace window | Single seat resume | Server-minted, held by client |
| **conversation/pair key** | Durable per **relationship** | The two playerIds | `pairKey(a,b,"chat")` = `chat:<lo>:<hi>` (playerId-sorted) |

### 1.2 Authority assignments (NON-NEGOTIABLE)

| Job | Authoritative key | Why |
|---|---|---|
| **(a) Address a live message** | recipient **`playerId`** → resolve to *current* `sessionId` at send time via `byPlayerId` | The sender knows only the durable playerId; the live sessionId is an internal, volatile routing detail the sender must never see or cache. |
| **(b) Key the outbox** | recipient **`playerId`** (enqueue `to`, drain `to`) | The message must survive the recipient's sessionId churning across reconnects, room hops, and restarts. A sessionId-keyed outbox is undeliverable by definition. |
| **(c) Presence** | **`playerId`** is the identity; `sessionId` is the *current incarnation* | "Is P online?" = "does `byPlayerId` hold a live sessionId for P?" Never reason about presence by sessionId. |
| **Conversation continuity / authz** | **pair key** over the two `playerId`s | Survives both sides reconnecting with new sessionIds; this is why `acceptedPairs` is keyed by playerId, not session. |

`sessionId` is authoritative for exactly **one** thing: the binary state-sync
seat and AOI view membership. It must **never** key the outbox, a conversation,
or an accepted pair.

### 1.3 Where the current code conflates them (must fix)

1. **`claimPlayerId` collapses playerId → sessionId on collision.**
   `PlazaRoom.claimPlayerId` returns `sessionId` as the player's `playerId` when
   the requested id is a duplicate or malformed. That means a second window
   sharing the localStorage playerId either (a) gets evicted by
   `replaceDuplicatePlayerId`, or (b) if eviction is off, is addressed by a
   **sessionId masquerading as a playerId** — the outbox key, pair key, and
   peer's address book all silently diverge. **A playerId must be globally
   unique per live human, enforced before this fallback can ever fire.**

2. **`byPlayerId` is a single-process map with last-writer-wins.** Across a
   reconnection-grace overlap (old seat still held, new seat joining) two
   sessionIds transiently claim the same playerId; whichever write lands last
   wins, and live routing can target the dead one (failure #3). The index needs
   an explicit, ordered handoff (§3).

3. **Client trusts `localStorage` playerId as device-unique.** Two windows on
   one origin = one playerId (failure #1). The playerId must be **per live
   tab/instance-disambiguated** OR the client must refuse to run two instances
   (the globalThis mount guard already does this for one tab, but not across
   two windows/devices that legitimately share an install for testing).

> **Decision:** keep `playerId` durable-per-install for real users (the social
> graph and outbox are keyed on it and must persist across app restarts). Solve
> the two-windows-one-install case at the **mount/identity** layer, not by
> making playerId ephemeral — see §3.6.

---

## 2. The outbox (the part the owner cares about most)

### 2.1 The fatal premise the current design violates

> Colyseus rooms are **in-memory and disposed when empty**, and the host is a
> **single container that restarts on deploy/crash**. Therefore a 24 h outbox
> **cannot** live in room memory or process memory. It dies with the room or the
> process — which is exactly why offline delivery has *never* worked.

The current `createMemoryOutbox()` is a `Map` in `index.ts` module scope. It
survives *room* disposal (good, that was deliberate) but **not** process
restart, and **not** the loss of the in-memory `acceptedPairs` that gate
enqueue. Both must move to a durable store.

### 2.2 Chosen store: **SQLite on the box** (single file, WAL mode)

Justification for an on-device-pair product with a small self-host (one
`t4g.micro`):

- **Survives restart/deploy/crash** — the file outlives the process. This is the
  whole point.
- **Zero new infra / zero new paid service** — no Redis, no managed DB; fits the
  "no new paid service" constraint already stated for Teletron in `index.ts`.
- **Transactional** — enqueue, drain, and mark-delivered are ACID; no lost or
  double-counted envelopes under concurrent room access.
- **Right scale** — a penpal product buffers, at most, a bounded handful of
  envelopes per offline recipient (the per-recipient cap stays). SQLite handles
  this with margin; the 24 h TTL keeps it tiny.
- **Trivially testable** — `:memory:` SQLite in unit tests; a temp-file SQLite
  in integration tests that asserts survival across a simulated restart.

> Redis is the right answer **only** when the server goes multi-process /
> multi-box (then the outbox must be shared across processes anyway). Keep the
> `Outbox` interface (already present) as the seam so a `createSqliteOutbox()`
> drops in today and a `createRedisOutbox()` later, with **no PlazaRoom change**.
> Colyseus `presence`/driver is rejected: its durability guarantees are weaker
> than a WAL'd file and it couples message durability to matchmaking state.

The `Outbox` interface stays exactly as-is (`enqueue`/`drain`/`sweep`/
`removeForPair`/`removeForPlayer`/`size`) — but `drain` must become a
**two-phase, ack'd** operation (§2.5), not delete-on-read.

### 2.3 Durable companion state

Two more pieces must move to the durable store, or the outbox alone is useless:

- **`acceptedPairs`** (the chat link authz + 24 h living-link TTL). If this dies
  on restart, the sender's `chat-send` is rejected and nothing is enqueued.
  Persist `{ pairKey, a, b, kind, expiresAt }`.
- **A per-recipient inbox cursor / dedupe set** is NOT needed server-side
  (clients dedupe — §5), but the server MUST persist `delivered` markers so a
  crash between "sent to client" and "client ack" does not lose the message
  (at-least-once — §2.5).

Presence (`byPlayerId`, `players`) stays in-memory: it is inherently live state
and is rebuilt on join. Only **link authz** and **buffered messages** are
durable.

### 2.4 Schema

```ts
// Durable envelope (SQLite row). Mirrors OutboxEnvelope + delivery state.
interface OutboxRow {
  id: string            // server-minted, unique: `ob-<ulid>`. The ACK key.
  pairKey: string       // chat:<lo>:<hi> — for removeForPair / TTL-by-link
  toPlayerId: string    // recipient (drain key) — INDEXED
  fromPlayerId: string  // sender
  payloadJson: string   // the sanitized MediatedChatInput, verbatim & opaque
  ts: number            // enqueued at (server wall clock)
  expiresAt: number     // ts + livingLinkTtlMs (24h)
  deliveredAt: number | null  // null = undelivered; set on client ACK
}

// Durable link authz.
interface AcceptedPairRow {
  pairKey: string       // PRIMARY KEY
  a: string; b: string; // playerIds (sorted)
  kind: "chat"
  expiresAt: number
}
```

Wire messages (additive to `MP_MSG`):

```ts
// S→C: deliver one buffered (or live) message. Carries the server ACK id.
chatDeliver: { envelopeId: string, payload: MediatedChatInput }   // EXTENDED
// C→S: client confirms it durably persisted the delivered message.
chatDeliverAck: { envelopeId: string }                            // NEW
```

> Today `chatDeliver` carries the bare `MediatedChatInput` (live path) **or**
> `env.payload` (flush path) with **no envelope id** and **no ack** — so the
> server deletes-on-drain and a drop between send and client-persist loses the
> message permanently. The envelope id + ack closes that hole and is what makes
> delivery *at-least-once* instead of *at-most-once*.

### 2.5 Enqueue path (sender online, recipient offline)

```
A's client: room.send(chat-send, MediatedChatInput{ to: P_b, ... })
  └─ server chatSend handler:
       1. validate schema
       2. resolve from = players[session].playerId  (NEVER trust payload.from)
       3. if blockedEitherWay(A,B) → drop (silent ok; blocked)
       4. load acceptedPair(A,B,"chat") FROM DURABLE STORE
            ├─ missing/expired → NACK to A (chatRejected{reason:"no-link"})  ← NEW: never silent
            └─ present:
       5. toSession = byPlayerId[P_b]   (live lookup)
       6. if toSession resolves to a LIVE client:
            → stamp from/to/targetLanguage, send(chatDeliver,{id,payload})
            → touchAcceptedPair (extend TTL) in durable store
            → record OutboxRow with deliveredAt=null  ← so a same-instant drop is recoverable
            → on chatDeliverAck{id}: set deliveredAt=now (or delete row)
          else (recipient OFFLINE):
            → outbox.enqueue(OutboxRow{ id, pairKey, to:P_b, from:A, payload, ts, expiresAt })
            → touchAcceptedPair in durable store
            → sendChatControlToClient(A, "partner-left")   (UI honesty)
```

Key correctness points vs. today:
- Enqueue and the ack-able live path both **write a durable row** — there is no
  window where a message exists only in a socket buffer.
- The accepted-pair check reads the **durable** pair, so a restart between
  invite-accept and send does not silently swallow the message.
- A missing link produces a **NACK**, not a silent drop (failure #1's invisible
  half).

### 2.6 Drain path (recipient (re)joins)

```
B's client (re)joins teletron room, binds chatDeliver + chatDeliverAck handlers,
then sends profile-publish (the "I am ready" signal).
  └─ server profilePublish handler (or a dedicated `ready` msg — see §3.5):
       1. pending = outbox.peekUndelivered(P_b, now)   ← READ, do NOT delete
       2. for each env in pending:
            client.send(chatDeliver, { envelopeId: env.id, payload: env.payload })
       3. (do NOT delete yet)
  └─ B's client, per delivered message:
       a. lessonify + render + persist to IndexedDB transcript (idempotent on interactionId)
       b. room.send(chatDeliverAck, { envelopeId })
  └─ server chatDeliverAck handler:
       outbox.markDelivered(env.id)   ← delete row OR set deliveredAt
```

- **Two-phase (peek → send → ack → delete)** makes delivery **at-least-once**:
  if B drops mid-flush, the unacked rows remain and re-flush on next join.
- Idempotent client persist (already keyed on `interactionId`) absorbs the
  resulting duplicates (§5).
- Expired rows (`expiresAt <= now`) are filtered on peek and swept on a timer
  (the 60 s sweeper stays, now against SQLite).

> **This single change — durable store + peek/ack/delete instead of in-memory
> delete-on-drain — is the fix for failure #2.**

---

## 3. Connection & rejoin lifecycle

### 3.1 Invariants the lifecycle must hold

1. **At most one live presence connection per playerId per process**, and at
   most one *intended* connection per client instance.
2. The live message channel is **never bound to a dead session**: when a seat is
   replaced or expires, `byPlayerId[playerId]` points at the *new* live session
   or is absent — never at a corpse.
3. **No double-mount**: hot-reload / StrictMode / re-mount tears down the prior
   instance first (the existing `globalThis` `__teletronMount` guard — keep it).
4. **Reconnect resumes the same seat** within the grace window; after it, a
   clean fresh-join re-establishes presence **without** corrupting the durable
   conversation (link authz + transcript survive independently).

### 3.2 Server-side join/leave/rejoin sequence (text diagram)

```
                 ┌────────────────────────── onJoin(client, {playerId:P}) ──────────────────────────┐
                 │ 1. validate P (PlayerId). If invalid → assign a FRESH server id, never reuse      │
                 │    another live P. (claimPlayerId must guarantee global-per-live uniqueness.)     │
                 │ 2. DUPLICATE HANDOFF (ordered, not racy):                                         │
                 │      old = byPlayerId[P]                                                           │
                 │      if old && old != session:                                                    │
                 │        a. byPlayerId[P] = session   ← reassign FIRST (new seat owns routing)      │
                 │        b. oldClient.leave(4000,"replaced")                                         │
                 │        c. removeSession(old) cleans AOI/state but MUST NOT delete byPlayerId[P]   │
                 │           because it now points at the NEW session (guard: only delete if ==self) │
                 │ 3. create PlayerState, players[session]=p, byPlayerId[P]=session                  │
                 │ 4. linkAoi; notify accepted partners "partner-returned"                            │
                 │ 5. DO NOT flush outbox here — wait for client "ready" (§3.5)                       │
                 └───────────────────────────────────────────────────────────────────────────────────┘

  onLeave(client, consented):
     if !consented && reconnectionSeconds>0:
        try await allowReconnection(client, N)      // SAME session resumes; seat held
            → on success: return (byPlayerId[P] still valid, seat intact)
        catch: fall through
     removeSession(session)  // grace lapsed or consented leave
        └─ ONLY delete byPlayerId[P] if byPlayerId[P] === this session  ← prevents failure #3

  reconnect (client.reconnect(token)):
     Colyseus resumes the SAME seat & sessionId → onJoin does NOT re-run.
     Client re-binds handlers + re-sends "ready" → server re-peeks outbox (idempotent).
```

The two load-bearing fixes here:
- **Reassign `byPlayerId[P]` to the new session *before* evicting the old**, and
- **`removeSession` deletes the index entry only if it still owns it**
  (`byPlayerId.get(P) === sessionId`). Today `removeSession` deletes
  unconditionally when `byPlayerId.get(player.playerId) === sessionId` — correct
  guard exists, but the *eviction order* in `onJoin` (evict-then-set) leaves a
  window; flip to set-then-evict.

### 3.3 Client-side connect/bind sequence

```
mountTeletronOnce (globalThis guard tears down prior instance)
  └─ user enters waiting room → connect()
       └─ createResilientRoom({ roomName:"teletron", joinOptions:{playerId:me,...},
                                onRoom: bindRoom, onRoomLost: loseRoom, onStatus })
            ├─ join() | reconnect(token)
            └─ on (re)join → bindRoom(room):
                 1. BIND handlers FIRST: players.onAdd/onRemove, profileCard,
                    invited, inviteResult, chatDeliver, chatDeliverAck-source, chatControl
                 2. THEN publishProfile()  ← the "ready" signal that triggers outbox flush
                 3. hydrateInbox() once (cold start only)
  └─ onRoomLost → loseRoom(): detach handlers, mark partners offline,
                  DO NOT clear conversations or end links (async penpal stays alive)
```

The ordering (**bind chatDeliver before publishProfile**) is already correct and
commented in `bindRoom`; keep it and add the `chatDeliverAck` send inside the
`chatDeliver` handler *after* the transcript persist resolves.

### 3.4 What must NOT happen on rejoin (failure #3 guardrails)

- `bindRoom`'s `players.clear()` is fine for **presence** but must **not** drop
  `conversations` or transcripts. (It doesn't today — keep it that way.)
- `restoredConversation`/`hydrateInbox` one-shot must not *re-clobber* a
  conversation that came alive via a live message during hydration. (The
  `conversations.has(...)` guard in `hydrateInbox` handles this — keep it, and
  add the same guard to any rejoin-time rebuild.)
- A fresh-join after a real drop must re-publish profile so the server re-peeks
  the outbox — undelivered messages from the drop window are re-flushed.

### 3.5 Add an explicit `ready` signal (don't overload profile-publish)

Today the outbox flush is triggered as a side-effect of `profilePublish`. That
conflates "I revealed my profile" with "I have bound my chat handlers and am
ready to receive." A privacy-conscious user who never publishes a stack would
**never** flush their outbox. **Add a dedicated `ready` C→S message** (or flush
on the existing implicit first message) that the client sends *after* binding
`chatDeliver`/`chatDeliverAck`, independent of any profile reveal. Flush is
idempotent (peek/ack), so re-sending `ready` on every rejoin is safe.

### 3.6 Two-windows-one-install (failure #1 reproduction)

For real users this is rare (one install = one human). For the owner's manual
two-window test it is the default, and it breaks delivery. Resolve at the
identity layer:

- **Production:** keep durable per-install `playerId`. The globalThis mount guard
  ensures one instance per WebView.
- **Manual two-window testing:** allow a per-instance override —
  `?playerId=` query param (or `?as=alice`) that **supersedes** the localStorage
  id — so two windows on one machine are two distinct humans. Document this in
  the test recipe (§6). Without it, the two windows fight over one seat and the
  test proves nothing.

---

## 4. Live delivery routing

A message addressed to peer **P** must reach P's **current** live session, even
after P reconnected with a new sessionId.

```
sender: room.send(chat-send, { to: P_playerId, ... })       // addresses by DURABLE playerId
server:
  toSession = byPlayerId.get(P_playerId)                     // resolve at SEND time, not cached
  toClient  = clientsBySession.get(toSession)
  if toClient is live: toClient.send(chatDeliver, {id, payload})
  else: enqueue to durable outbox (recipient offline)
```

Correctness requirements:
- The sender **never** caches or sends a sessionId. It only ever holds
  `playerId`. (Already true in Teletron's `convoWire`/`openPartnerWire` — they
  carry only playerId.)
- `byPlayerId` is resolved **per message**, so a peer who reconnected with a new
  sessionId is reached at their new seat with no sender involvement.
- The §3.2 ordered handoff guarantees `byPlayerId[P]` points at the **new** seat
  the instant the replacement joins — so even an in-flight message during a
  reconnect lands on the live session, not the corpse.
- AOI must keep both penpals mutually present. Teletron's `cellSize:10000,
  radius:1` puts the whole lobby in one cell — verify a pair is always in each
  other's `StateView` so `players.onAdd` fires on both sides (presence drives the
  "partner online" UI and the invite flow). If AOI ever drops a far peer,
  **chat routing must not depend on AOI/StateView** — it goes through
  `byPlayerId` directly (it does today; keep that decoupling).

---

## 5. Delivery guarantees

### 5.1 At-least-once + client de-dupe

- **Guarantee:** at-least-once. The server may deliver the same envelope twice
  (crash between client-persist and server-ack; reconnect re-flush).
- **De-dupe key (client):** the **`interactionId`** carried in
  `MediatedChatInput`. The IndexedDB transcript store is already idempotent on
  message id (`transcripts.append` keyed on `interactionId`); the render path
  must consult the same key so a re-delivered message is **persisted once and
  rendered once**.
  - Today `enqueueReceive` → `receive`/`receiveBackground` does **not** check
    "have I already seen this interactionId?" before rendering. Add a
    seen-set (in-memory, seeded from the transcript on hydrate) gating render +
    unread-bump. Persist remains idempotent; render must become idempotent too.
- **Server de-dupe of envelope ids:** `chatDeliverAck` is idempotent
  (`markDelivered` on an already-delivered id is a no-op).

### 5.2 Ordering

- **Per-pair, per-direction FIFO.** The outbox drains in `ts` order (enqueue
  order). The client `receiveTail` promise chain already serializes inbound
  processing — keep it; it guarantees in-order render even though lessonify is
  async.
- Cross-pair ordering is not guaranteed and does not matter (independent
  conversations).
- The peek/ack drain must preserve `ORDER BY ts ASC` and must not re-order
  unacked rows ahead of newer ones on re-flush (re-flush replays the same FIFO).

### 5.3 On double-delivery

- Transcript: no-op (idempotent on interactionId).
- Render: suppressed by the seen-set (§5.1).
- Unread badge: not bumped twice (gated by the same seen-set).
- Quota: never consumed on **receive** (only on send) — double-receive cannot
  burn quota.
- Net effect: a duplicate is invisible to the user. This is the whole point of
  choosing at-least-once + idempotent consumer over the un-achievable
  exactly-once.

---

## 6. REVIEW CHECKLIST (run against the implementer's diff)

Grouped by the failure each item defends. An item is **PASS** only with the
evidence named (a test, a log line, or the two-window observation), not by
inspection of "looks right."

### A. Durability — kills failure #2 (offline → online delivery)

1. The outbox is backed by a **persistent store** (SQLite WAL file on the box),
   not a `Map`/process memory. Grep: no `createMemoryOutbox()` in the production
   `index.ts` boot path.
2. `acceptedPairs` (chat link authz + 24 h TTL) is **also** persisted; a sender's
   `chat-send` after a simulated restart still passes the link check and enqueues.
3. There is an **integration test that restarts the store** (close + reopen the
   SQLite file, or new `Outbox` instance over the same file) and asserts a
   pre-restart envelope still drains. (Today no test exercises restart survival.)
4. `chatDeliver` carries a server **`envelopeId`**; a `chatDeliverAck` message
   exists; the server deletes/marks-delivered **only on ack** (peek → send →
   ack → delete), not delete-on-read.
5. A test proves **at-least-once**: client drops between deliver and ack → on
   re-join the envelope is re-delivered (row still present, `deliveredAt` null).
6. Expired envelopes (`expiresAt <= now`, 24 h) are filtered on peek **and**
   swept on the 60 s timer; a test asserts a 25-h-old envelope is not delivered.
7. Per-recipient bound (cap) is preserved against the durable store; a flood test
   asserts oldest-dropped with a loud `console.warn`.
8. `removeForPair`/`removeForPlayer` operate on the durable store (block/report
   and link-end still purge buffered messages).

### B. Identity & routing — kills failure #1 (both online → silence)

9. A `playerId` is **globally unique per live human**; `claimPlayerId` can no
   longer hand one human a sessionId-as-playerId that diverges the outbox/pair
   keys. Test: two joins with the same requested playerId resolve deterministically
   (one wins the seat via ordered handoff; the other does not silently get a
   different addressable id).
10. `byPlayerId` reassignment in `onJoin` is **set-then-evict** (new seat owns
    routing before the old seat is told to leave). Inspect the `onJoin`
    duplicate branch order.
11. `removeSession` deletes `byPlayerId[P]` **only if it still owns it**
    (`=== sessionId`). Test: reconnect-grace overlap does not orphan routing.
12. `chat-send` with **no accepted pair** sends a **NACK** to the sender
    (`chatRejected`), not a silent drop. Test asserts the NACK; UI surfaces
    "couldn't send" instead of a fake-sent bubble.
13. Live routing resolves `byPlayerId` **per message** (not cached sessionId).
    Grep the chatSend/chatControl handlers.
14. The sender never transmits or caches a `sessionId`; it addresses only by
    `playerId`. Grep client: no sessionId in any outbound payload.
15. Chat routing does **not** depend on AOI/`StateView` membership — it goes
    straight through `byPlayerId`. (Presence UI may use AOI; delivery must not.)

### C. Lifecycle / rejoin — kills failure #3 (can't get back in)

16. `bindRoom` binds `chatDeliver` (and `chatDeliverAck`-source) **before**
    publishing profile / sending `ready`. (Already true — confirm not regressed.)
17. The outbox flush trigger is a **dedicated `ready` signal**, not a side-effect
    of `profilePublish`, so a user who never reveals a profile still receives
    buffered messages. Test: join without `profilePublish` → still drains.
18. `onRoomLost`/`loseRoom` marks partners offline but does **not** clear
    `conversations`, end links, or wipe transcripts.
19. Re-entering a conversation rebinds without clobbering a conversation revived
    by a live message during hydration (`conversations.has(...)` guard intact).
20. `unmount` does **not** send `chatControl{ended}` (would forget the pair +
    purge the outbox). Only the explicit End button / Block tears the link down.
    (Already commented — confirm not regressed.)
21. A reconnect within the grace window resumes the **same** seat (sessionId
    unchanged); a fresh-join after grace re-establishes presence and re-flushes
    the outbox. Both proven by test/log.
22. The globalThis `__teletronMount` idempotent guard is intact (one instance per
    WebView; hot-reload/StrictMode tears down the prior one).

### D. Guarantees / de-dupe

23. Client de-dupe is keyed on **`interactionId`**; a re-delivered message is
    persisted once **and rendered once** (seen-set gates render + unread, not
    just persist). Test delivers the same envelope twice → one bubble, one
    transcript row, unread +1 not +2.
24. Inbound ordering is preserved per pair/direction (drain `ORDER BY ts ASC`;
    `receiveTail` chain intact). Test: 3 buffered messages render in send order.
25. Receiving a message never consumes send-quota.
26. `chatDeliverAck` and `markDelivered` are idempotent (acking twice is a no-op).

### E. Schema / contract hygiene

27. `MP_MSG` gains `chatDeliverAck` (+ optional `chatRejected`); `chatDeliver`
    payload extended with `envelopeId`; client + server use the shared `MP_MSG`
    constants (no string drift).
28. The extended `chatDeliver`/new ack messages are Zod-validated at both ends.
29. The `Outbox` interface is unchanged in shape (seam preserved) except
    `drain`→`peek`+`markDelivered`; PlazaRoom does not import SQLite directly
    (injected via `index.ts`, same as today's `outbox` option).

### F. The two manual two-window tests (the acceptance gate)

30. **Offline → online delivery (the headline promise).**
    - Open window 1 as Alice: `?as=alice` (or `?playerId=teletron-alice`), window
      2 as Bob: `?as=bob`. Confirm **distinct** playerIds (check the waiting
      room shows two people; check `localStorage`/query override took effect).
    - Alice invites Bob; Bob accepts; verify a live message goes **both ways**
      (this alone re-confirms failure #1 is fixed).
    - **Close Bob's window entirely** (recipient offline). Alice sends 2 messages.
      Server log: `enqueue` ×2; **no** `chatDeliver` to Bob.
    - **Restart the presence server** (kill + relaunch the container) to prove
      durability — the SQLite file survives.
    - Re-open Bob (`?as=bob`). On Bob's `ready`, server logs
      `flushed 2 buffered message(s)`; Bob sees **both** messages, in order, once
      each; Bob's client sends 2 `chatDeliverAck`; server marks delivered; a
      second Bob rejoin delivers **nothing** further.
    - **PASS only if** the messages arrive after a server restart and an empty
      room in between. (This is the 2 pm → 8 pm promise.)
31. **Leave → rejoin continuity.**
    - With an active Alice↔Bob chat, Bob backgrounds/closes within the 90 s grace
      and returns: same seat resumes, thread intact, no duplicate bubbles, no
      "can't get back in."
    - Bob fully cold-restarts the app (new sessionId): re-enters, the conversation
      is restored from IndexedDB as living/dormant (not corrupted, not ended),
      Alice→Bob and Bob→Alice still deliver, and any messages Alice sent while Bob
      was gone are flushed once.
    - **PASS only if** re-entry never corrupts state and routing reaches Bob's new
      session.

### G. Observability

32. Enqueue, peek, deliver, ack, sweep, and NACK each emit a visible log line
    (noisy-not-silent). No silent `catch`.
33. Outbox `size()` / undelivered-count is exposed for a healthcheck or log so the
    owner can confirm buffering is happening in prod.

---

## 7. Summary of the minimal correct change set

1. **Swap `createMemoryOutbox` → `createSqliteOutbox`** behind the existing
   `Outbox` seam; persist `acceptedPairs` too. *(fixes #2)*
2. **Make delivery at-least-once:** add `envelopeId` to `chatDeliver`, add
   `chatDeliverAck`, change drain to peek→send→ack→delete. *(fixes #2 durably)*
3. **Order the duplicate handoff** (set-then-evict) and guard
   `removeSession`'s index delete by ownership. *(fixes #3)*
4. **NACK on missing link**, and **resolve `byPlayerId` per message**. *(fixes #1's
   invisible drop)*
5. **Per-instance playerId override for testing**, keep durable per-install in
   prod. *(makes #1 reproducible/fixable)*
6. **Dedicated `ready` flush trigger** + **client render de-dupe on
   `interactionId`**. *(robust drain + clean duplicates)*

Everything else (resilientRoom backoff/wakers, the globalThis mount guard, the
IndexedDB transcript store, AOI, the moderation pipeline) is already correct and
should be preserved unchanged.
