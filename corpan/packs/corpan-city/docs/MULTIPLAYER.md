# Corpan City — Realtime Multiplayer

Two app windows become two real players in the same plaza: they see each other
walk, safely reveal profiles, invite each other to interactions, and use
two-sided AI-mediated cross-language chat. This document covers the server,
client presence and interaction layers, local development, QA, and the exact
`game.ts` wiring.

> Foundation reference: `docs/PREMIUM_FOUNDATIONS.md` §8.

---

## Architecture at a glance

```
  ┌── window A ──────────┐                 ┌── window B ──────────┐
  │ local player (pred.) │                 │ local player (pred.) │
  │ createNetClient ─────┼──move (~10Hz)──▶│                      │
  │   remote: B (interp) │◀── schema deltas │   remote: A (interp) │
  └──────────┬───────────┘   (binary, 20Hz) └──────────┬──────────┘
             │                                          │
             └──────────► Colyseus PlazaRoom ◀──────────┘
                          (authoritative state)
```

- **Authoritative server.** The server owns every position. Clients predict
  their OWN avatar locally (the existing `controller.ts`) and send movement; the
  server validates (max speed + room bounds) and writes state.
- **`@colyseus/schema` auto-sync.** The room's `players` map is a schema; the
  framework encodes binary deltas to all clients at the patch rate. No manual
  snapshotting.
- **Client interpolation.** Remote avatars render ~120 ms in the past from a
  small sample buffer, so motion is smooth under packet jitter.
- **Best-effort.** No server → the world runs solo. Presence never crashes the
  game.

---

## 1. The server (`server/`)

A tiny, self-contained Colyseus server co-located in the pack, sharing the
`@corpan-city/contracts` types.

| File | Role |
| --- | --- |
| `server/src/state.ts` | `@colyseus/schema` `PlazaState` + `PlayerState`, mirroring the contract `PresencePlayer`/`PresenceSnapshot`. |
| `server/src/PlazaRoom.ts` | The authoritative room: `onJoin`/`onLeave`/`onMessage("move")`, movement validation, reconnection. |
| `server/src/index.ts` | Boot + matchmaking (one `plaza` type, fill-then-spin). |

### State (auto-synced)

`PlazaState.players: MapSchema<PlayerState>` keyed by Colyseus `sessionId`.
`PlayerState` = `{ playerId, name, avatar(JSON), x, z, facing, sceneId, questId, t }`.
The `avatar` is the contract `AvatarSpec` serialized as one JSON leaf — it never
changes after join, so it costs nothing on the movement hot-path; the client
re-parses + re-skins it into ITS local scene (divergent worlds, shared collision
space).

### Messages

- **`onJoin(client, options)`** — reads `name` + `avatar` (validated with the
  contract `AvatarSpec`) + `sceneId`/`questId` from join options, spawns the
  player at a round-robin authoritative spawn point.
- **`onMessage("move", MovementUpdate)`** — validates with the contract zod
  schema, drops stale/duplicate `seq`s, **clamps to room bounds**, and applies an
  **anti-teleport** speed cap (server wall-clock dt × max speed) so a forged
  position is clamped to the speed envelope rather than trusted.
- **`onLeave`** — `allowReconnection(client, 20)` keeps a dropped player in-world
  briefly (backgrounded app / flaky wifi) before removing them.

### Scaling / matchmaking

`gameServer.define("plaza", PlazaRoom, { topology })` with
`.sortBy({ clients: -1 })` — matchmaking prefers the most-occupied room that
still has free slots, so a freshly-joined pair shares one plaza until it fills to
`PlazaRoom.maxClients` (≈30), then a sibling room spins automatically for the
next cohort. `enableRealtimeListing()` exposes live room occupancy for a future
room directory.

### Run it

```bash
cd packs/corpan-city
npm run server:install   # one-time: install server deps (separate package)
npm run server           # boots on :2567 (configurable via PORT)
```

### Version pinning (important)

The published **client `colyseus.js@0.16.x`** speaks the **0.16** matchmaking
protocol (nested seat reservation) and **`@colyseus/schema@3`**. Colyseus
**0.17** server changed both (flat seat reservation + schema 4) and is
incompatible with the published client. So the server pins the **0.16 line**:
`@colyseus/core@^0.16.24` + `@colyseus/ws-transport@^0.16.5` +
`@colyseus/schema@^3`. (We depend on `@colyseus/core` directly rather than the
`colyseus` meta-package, whose `0.16.2+` tarballs are mis-published with empty
`dependencies`.)

---

## 2. The client presence layer (`src/net/`)

| File | Role |
| --- | --- |
| `src/net/netClient.ts` | `createNetClient(...)` — connection, movement broadcast, remote lifecycle, the AI-chat seam. |
| `src/net/remoteAvatar.ts` | One remote player rendered + interpolated as a grounded cutout. |
| `src/net/index.ts` | Barrel export. |

### API

```ts
const net = createNetClient({
  url: "ws://localhost:2567",     // or wss://… in prod
  room: "plaza",
  identity: { playerId, name, avatar, sceneId, questId },
  topology,                        // the shared RoomTopology
  scene: world.scene,              // remote avatars render here
  theme: ANTIGUA_1770,             // re-skin remotes into the local scene
  getLocalPos: () => player.getPos(), // live predicted local position
  onStatus, onRemoteAdd, onRemoteRemove, // optional observability
})
// each frame:
net.update(dt)   // broadcasts local movement (~10Hz) + advances interpolation
// teardown:
net.dispose()    // leaves the room + disposes all remote meshes
```

### How remote avatars render

Each remote player is a `createRemoteAvatar(scene, …)` that reuses the EXACT
local look: `avatarToCharacterSpec` (or a deterministic `generateCharacter`
fallback if the broadcast avatar is empty) → `createGroundedCutout` (same shared
contact-shadow) → `createAnimator`. **A remote human is visually indistinguishable
from a local NPC** — they're just people walking the plaza. The broadcast
`AvatarSpec` is re-skinned with the LOCAL `theme`, so you see them dressed for
*your* world.

### How they interpolate

The net client stamps each authoritative delta with the local render clock and
pushes `{x, z, facing, t}` into a small ring buffer. `remoteAvatar.update`
renders the point `INTERP_DELAY_MS` (≈120 ms) in the past, **lerping between the
two samples that straddle that time** — classic entity interpolation that hides
jitter. Locomotion speed is derived from the interpolated displacement, so a
remote walker bobs (walk anim) and a stander breathes (idle anim) automatically,
with no extra wire data.

### Best-effort / offline

`createNetClient` connects asynchronously and **degrades silently** on any
failure (no server, refused, timeout): it logs a single visible warning and the
world keeps running solo. A non-consented disconnect marks `reconnecting` and
clears remote avatars; the framework's `allowReconnection` window can recover the
session. Nothing about presence can crash single-player.

---

## 3. `game.ts` wiring (exact)

`game.ts` already builds `world` (engine+scene), `topology`, `scene` (the active
data Scene), `identity` (name+avatar), and `player` (`createPlayerController`,
exposes `getPos`). Add the net client AFTER the world + player exist, feed it
`player.getPos`, drive it from the frame loop, and dispose it on teardown.

```ts
// near the other imports
import { createNetClient, type NetClient } from "./net"
import { ANTIGUA_1770 } from "./character/characterGen"

// after `const player = createPlayerController(world, topology, input, identity.avatar)`
// (and after `scene` is parsed):
let net: NetClient | null = null
// Opt-in / best-effort: only attempt if a multiplayer URL is configured.
const mpUrl = import.meta.env.VITE_WP_MULTIPLAYER_URL as string | undefined
if (mpUrl) {
  net = createNetClient({
    url: mpUrl,
    room: "plaza",
    identity: {
      playerId: identity.playerId,   // the GeneratedIdentity's id
      name: identity.displayName,
      avatar: identity.avatar,
      sceneId: scene.id,
      questId: activeQuestId ?? "",
    },
    topology,
    scene: world.scene,
    theme: ANTIGUA_1770,             // or the active scene's theme
    getLocalPos: () => player.getPos(),
  })
}

// inside the existing `world.onFrame((dt) => { … })`, after `player.update(dt)`:
net?.update(dt)

// inside dispose(), alongside the other teardown:
net?.dispose()
```

Notes:
- **Opt-in flag.** Gate on `VITE_WP_MULTIPLAYER_URL` (build-time) so single-player
  is unaffected when no server is configured. (A runtime config/host setting works
  too — anything that yields the URL or `undefined`.) Even when set, the client is
  best-effort and degrades to solo if the server is unreachable.
- **Ownership.** The net client OWNS the remote-avatar meshes. `game.ts` only
  calls `update(dt)` and `dispose()`; it never touches remote rendering.
- **`getLocalPos`** wants the live predicted position. `player.getPos()` returns
  `{x, z}`; facing is optional (defaults 0). If you later expose the player yaw,
  return `{ x, z, facing }` for correct remote facing.

---

## 4. Run two clients (the wow) + self-verification

### Manual two-window

```bash
cd packs/corpan-city
npm run server:install      # one-time
npm run server              # terminal 1 — Colyseus on :2567
npm run dev -- --port 5174  # terminal 2 — vite
# open two browser windows:
#   http://localhost:5174/qa/mp.html?name=Ada&server=ws://localhost:2567&hat=%23e0c060
#   http://localhost:5174/qa/mp.html?name=Ben&server=ws://localhost:2567&hat=%23c0392b
# walk with WASD in one — watch the other window's avatar move.
```

### Automated (Playwright / webkit)

```bash
npm run qa:mp     # boots server + vite, opens TWO webkit windows, asserts B
                  # sees A walk, screenshots → /tmp/wp-mp-A.png /tmp/wp-mp-B.png
# reuse an already-running server+vite:
WP_MP_REUSE=1 node qa/mp-presence.mjs
```

`qa/mp-presence.mjs` boots the stack, opens two windows with distinct
identities, moves window A, and **asserts window B receives + renders A's
movement** (polls B's remote-avatar position for A, checks it tracks A's actual
local position), captures B's fps with a remote avatar present, and screenshots
both windows. Verified result: **two windows online, each sees the other walk,
~0 tracking error, 60 fps, no errors.**

> WebKit quirk (handled): colyseus.js' transport probes the Node `WebSocket`
> overload first, which throws a benign "Wrong protocol for WebSocket
> '[object Object]'" in Safari/WebKit that it catches and recovers from — the
> connection still succeeds. The harness filters this false positive.

---

## 5. AI-mediated chat

Mediated chat stays outside the movement hot path:

- **Sender safety pass.** The author's local model cleans raw text into a safe
  intent before `chat-send`. A model failure sends only a fixed harmless line.
- **Trusted routing.** The server validates the typed input, rate-limits it,
  stamps the live sender/recipient identities, and routes the safe intent.
- **Recipient safety + translation pass.** The recipient's local model treats
  the intent as untrusted, cleans it again, translates it into their learning
  language, and adds a native-language meaning and optional lesson hints.
- **Safe failure.** A missing, busy, or invalid recipient model never displays
  the received intent; the UI shows a fixed harmless fallback instead.

---

## Player-to-player INTERACTION (shipped — profile · chat · challenge · trade)

The interaction layer (`src/multiplayer/*`, server handlers in `server/*`, new
contracts `profile.ts` + `mp.ts`) is the realization of the "mediated chat slots
in" promise above, plus three more verbs — all ADDITIVE + feature-detected. With
no server URL (`resolveServerUrl()` → undefined) nothing connects and the
single-player game is byte-for-byte unchanged. The whole layer is one wiring call
in `game.ts`: `initMultiplayer(...)`.

### The wire protocol (`contracts/mp.ts`)

All cross-player traffic is a typed `room.send(name, payload)` / `onMessage` over
the SAME Colyseus room used for movement (never a second socket, never P2P). The
message names live in `MP_MSG`; every payload is a Zod schema validated at BOTH
ends (the server trusts no client; the client re-validates every server message
before rendering). There is no channel for raw free text/audio between humans —
only menu choices and AI-mediated artifacts cross the wire.

| direction | name | payload | purpose |
|-----------|------|---------|---------|
| C→S | `profile-publish` | `ProfilePublish` | publish my stack (synced) + my country (PRIVATE, histogram only) |
| C→S / S→C | `profile-request` / `profile-card` | `ProfileRequest` / `SafeProfile` | request + receive a k-anon-coarsened card |
| C→S / S→C | `invite` / `invited` | `InviteMessage` / `InvitedMessage` | invite to chat/challenge/trade |
| C→S / S→C | `invite-respond` / `invite-result` | … | accept/decline + outcome |
| C→S / S→C | `chat-send` / `chat-deliver` | `MediatedChatInput` | route a locally-cleaned chat line |
| C→S / S→C | `peer-result` / `peer-result-deliver` | `PeerChallengeResult` | reconcile a shared challenge |
| C→S / S→C | `trade` / `trade-update` | `TradeEnvelope` | trade transport (body opaque to us; economy owns it) |

### The privacy / k-anonymity reveal model (`contracts/profile.ts`)

The keystone. When you approach another real player you may learn a *little* about
them, never enough to identify/locate/contact them. The only facts ever revealed
are (1) their language **stack** (always safe — a (native,target) pair is shared
by millions) and (2) a **coarse place**, and only when revealing it can't single
them out:

- country population **> K_ANON** others online → reveal the **country** ("Japan")
- else continent population **> K_ANON** → reveal the **continent** ("Asia")
- else → reveal **nothing** ("somewhere out there")

`K_ANON = 5` is a CONTRACT CONSTANT (not a server env knob) so an operator can't
quietly weaken the floor; raising it only makes reveals coarser (safer). The
crucial property: **the finer fact never leaves the server unless the threshold
is met** — the player's raw country lives only on their device and in the server's
private `GeoHistogram` (never in synced schema state, which would broadcast it).
A viewer receives only the already-coarsened `PlaceReveal`, and `PlaceReveal` has
NO city/region/coordinate variant by construction. Self-country is derived
on-device from the locale region (`detectCountry()` in `geo.ts`) — never IP/GPS,
never a network call; if it can't be inferred, the player simply reveals "hidden".

### LLM-mediated cross-language chat (`mediatedChat.ts`)

Two players speaking different languages chat, and the on-device Qwen3 turns the
barrier into the lesson. The sender's device first asks its local model to
preserve the message's intent while removing unsafe content. Only that cleaned
intent is wrapped into `MediatedChatInput` and routed. The recipient's device
then independently cleans it again and asks its local model to produce a
`MediatedChatArtifact`: a natural message in the language the reader is
learning, a native-language meaning, optional transliteration/gloss, 2–3
tappable suggested replies, and one tiny lesson note.

Both passes reuse the shared NPC `ModelBroker`, honoring the single in-process
model slot. Missing, busy, failed, or invalid model output degrades to a fixed
harmless fallback, never to the received text. Deterministic output checks also
reject contact information before anything is sent or rendered.

### Player challenge (`peerChallenge.ts`)

A challenge invite carries a fully-built `ChallengeSpec`; BOTH players run the
identical spec through the existing public `runChallenge` overlay (no microgame is
reimplemented). Each side reports its `ChallengeResult` over the invite channel;
once both are in we reconcile a verdict (coop = shared bar; duel = higher score
wins) and BOTH players earn — a duel is practice, never punishment. If the partner
never reports, a timeout resolves it as a solo completion — your own score still
counts, so a peer challenge can never trap you.

### Trade transport (`tradeTransport.ts`)

`ColyseusTradeTransport` implements the economy layer's `TradeTransport` seam
(`src/economy/trade.ts`). Ownership split by design: the economy agent owns items,
the rich `TradeProposal`, validation, fairness, and the atomic apply; WE own only
the transport (route/sequence the proposal to the partner, fan inbound updates
back). The proposal body rides opaquely in `TradeEnvelope.proposal`, so the
economy proposal shape can evolve with no contract bump. Anti-grief: the server
rate-limits + size-bounds every envelope per kind; the transport drops updates for
trades it never started and body/envelope id mismatches; nothing auto-applies.

### Offline degradation

Everything multiplayer is gated on a live room. No server → `initMultiplayer` is
inert (no net client constructed; `update`/`dispose` are safe no-ops besides the
idle pip). The economy layer keeps using its own `LocalTradeTransport` when
`tradeTransport()` returns null. The single-player world is never blocked, slowed,
or changed by the presence or absence of multiplayer.

### Single game.ts wiring point

`initMultiplayer({ serverUrl: resolveServerUrl(), playerId, name, avatar,
topology, scene, overlay, challengeContainer, getLocalPos, learnerPair, hostApi,
broker: npcRuntime.broker, challengeHost, ... })` — one call right after the NPC
runtime is created (to reuse its broker), `mp.update(dt)` in the frame loop, and
`mp.dispose()` in teardown. That's the entire game.ts footprint.
