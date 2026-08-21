# Native capabilities

**What this is.** The contract a pack and the host agree on when the answer comes
from the *device* rather than from the host's own TypeScript: a sensor, a speech
synthesiser, an on-device model, a socket. One capability is built against it
today (`sensors.orientation`); this document is what the next five get built
against, and the shape is the deliverable rather than the feature.

**Read this first if you are adding one.** The checklist at the end is short and
every line of it is a mistake this repository has already made.

---

## The seam that already existed, and whether it was the right shape

A pack reaches the host through one `MessagePort` into an opaque-origin
sandboxed iframe. Everything it may ask for is a closed table
(`packs/sdk/src/capabilities.ts`), every method belongs to exactly one
capability, and the bridge (`dynawalla-app/src/packs/bridge.ts`) is the only
thing on the other end of the port.

**That was already the abstract interface, and it was 80% of the right one.**
Declare / grant / gate / dispatch needed no reshaping at all: a native capability
is a row in the same table, a string in the same manifest field, and an arm in
the same `switch`. The parts that had to change are the parts that only matter
when an answer is slow, repeated, refusable, or physically absent — and there
were four of them.

| | Before | Now |
|---|---|---|
| **Latency** | Every method answered in microseconds. No deadline anywhere: a host that dropped a request left the pack holding a promise that never settled. | `budgetMs` per capability, declared in the table. The guest arms a timer from it and rejects with `timeout`. 2s for a store read, 10s for something that may have to ask a person for permission. |
| **Streaming** | Not expressible. `Response` is one-shot; `HostEvent` is four names with no correlation to anything a pack asked for. | A third envelope: `StreamUpdate` / `StreamEnd`, correlated by a handle that **is** the request id. |
| **Cancellation** | Not expressible. The only way to stop anything was to end the session. | `stream.cancel`, a session method — not a grant, because a pack that cannot stop a stream leaves a sensor running after a child has left. |
| **Absence** | Conflated with grant. `HOST_SUPPORTS` is a compile-time list, and `gateInstall` *refuses the install* of a pack asking for something not in it. | `Connect.available`, a runtime intersection. Grant and availability are two questions, and a native capability stays in `HOST_SUPPORTS` forever once implemented. |

The fifth — **permission** — needed no protocol change at all, only a rule, and
the rule is the interesting part. It is below.

Nothing about the existing seam had to be replaced. That is the finding: a
capability table plus a validated port generalises to native work, provided the
envelope grows a stream and the table grows a budget.

---

## The five properties, and where each one lives

### 1. Latency — declared, not discovered

`budgetMs` is a field on the capability row. A pack does not have to guess how
long something might take, and a host that hangs is a `timeout` rather than a
loading screen forever.

- Declared: `packs/sdk/src/capabilities.ts` → `budgetOf(method)`.
- Enforced: `packs/sdk/src/guest.ts` → the timer in `call`.
- Asserted: every method has a finite budget ≤ 30s, and every native capability
  is allowed strictly longer than the slowest local one.

**A pack must never block a frame on a native call.** Nothing in the seam makes
that impossible; the promise is a promise and the game loop keeps running. What
the budget buys is that the promise *settles*.

### 2. Streaming — one envelope, one handle

```
pack → host   { id: 7, method: "sensors.orientation.start", params: {} }
host → pack   { id: 7, ok: true, result: { stream: 7 } }
host → pack   { stream: 7, seq: 1, data: {...} }
host → pack   { stream: 7, seq: 2, data: {...} }
pack → host   { id: 8, method: "stream.cancel", params: { stream: 7 } }
host → pack   { stream: 7, done: true, reason: "cancelled" }
```

The handle is the request id: no second namespace, no allocation, and the pack
already holds the number. Two guarantees the host owes:

- **Exactly one end**, always, with a reason — `complete`, `cancelled`,
  `unavailable`, `closed`, `internal`. A stream that goes quiet without an end is
  a host bug. (A start cancelled *while it was still starting* never became a
  stream the pack knows about, and gets no end.)
- **`seq` monotonic from 1.** A gap is a deliberate drop — throttled, or
  delivery suspended while the pack was paused. Nothing is retransmitted.

`PROTOCOL_VERSION` is **not** bumped by this. A stream envelope carries neither
`id`+`ok` nor `event`, so a 1.0 pack ignores one; and a 1.0 pack never opens a
stream, so it never receives one. `SDK_VERSION` goes to 1.1.0, which is what
`sdkCompatible` reads: a 1.0 pack runs on a 1.1 host, a 1.1 pack is refused by a
1.0 host.

### 3. Cancellation — and the two things it is not

`stream.cancel` is ungated and idempotent, and says nothing about what it found:
a pack must not be able to learn whether a handle it invented was real.

Beyond it, two host-side guarantees, because a pack cannot be trusted to be the
only thing that stops a sensor:

- **`pause` suspends delivery.** A game steering behind the day-pass sheet is a
  game the child is not playing. Samples are **dropped, not queued** — a buffer
  of stale tilt delivered on resume would snap whatever it steers across the
  screen. `frame.ts`'s `send` → `Bridge.setPaused`.
- **Nothing outlives the pack.** `dispose` calls `bridge.close()`, which ends
  every stream `closed` and releases every source, *before* the port dies.

### 4. Absence — loud to the developer, invisible to the child

Four layers, and the important one is the third.

1. **`HOST_SUPPORTS`** (`library.ts`) — what this *build* implements. A native
   capability belongs here as soon as the build implements it and **must never be
   removed to describe a device that cannot do it.** This list feeds
   `gateInstall`, which refuses the *install*; dropping `sensors.orientation`
   would stop a tablet with no gyroscope installing the pack rather than letting
   the pack run without tilt.
2. **The manifest's `capabilities`** — what the pack asked for. `gateRun`
   intersects the two every launch, and the result is `Connect.granted`.
3. **`HostServices.available()`** — what this *device* can do, right now. The
   frame intersects it with `granted` and sends `Connect.available`. It is a
   `Record<NativeCapability, boolean>` in `services.ts`, so **adding a native
   capability fails to compile** until somebody decides how to detect it.
4. **A stream that ends `unavailable`** — the case that only shows up after
   starting. `typeof DeviceOrientationEvent !== "undefined"` is true in every
   desktop browser with no sensor anywhere near it; what settles it is whether a
   reading with numbers in it ever arrives (`orientation.ts`, the warm-up).

**What a pack must do.** Nothing, in the failure case — which is the design.
The SDK's native surfaces never throw and never reject:

```ts
const host = await connect()

// Only needed before DRAWING a control that would otherwise be a lie.
if (host.available("sensors.orientation")) showTiltToggle()

// Never throws. On a device that cannot, the handler is simply never called.
const stop = host.tilt.start((sample) => steer(sample.x, sample.y))
```

and every absent path writes **one** loud `console.error` naming the capability
and what to do about it. `console.error` because Vite's dev client forwards
errors to the terminal and nothing else, and on a device that line is what
reaches a WebInspector session. Once per reason per pack, because a game loop
would print it sixty times a second.

Four packs have shipped blank in this repository and every one of them was quiet
about it. A tablet with no gyroscope is not a fault and a child must never see a
message about one; a developer whose tilt control silently does nothing must.

### 5. Permission — the host asks, on a gesture, in its own document

The constraint, which is not going away: **a pack has no user activation to lend
and no origin to hold a grant.** iOS requires transient user activation for
`DeviceOrientationEvent.requestPermission()` and remembers the answer per origin.
Activation does not cross a `postMessage`, and a pack's origin is opaque — not
something a grant can be remembered against.

So the rule, for this and for every native capability that needs consent:

> **The host asks, in the host's own document, from a real user gesture, at most
> once per install, and only when a pack that declared the capability is being
> launched. The pack is told the outcome as `available` and never the reason.**

Implemented as `primeOrientationPermission()` (`app/platform.ts`) called from
`useLaunch.play` (`packs/Stage.tsx`) — which runs synchronously inside the tap on
a pack's card, the last real gesture before the pack exists. A child playing the
other twenty-seven games is never shown a prompt about a sensor.

A refusal, a throw and a silence are all treated as the same answer: *this device
cannot*. The capability degrades to absent rather than to broken.

---

## What landed, and what is unproven

`sensors.orientation` — the host reads the tilt and posts it, exactly as it
already measures the safe-area insets a pack cannot see.

A pack is granted **no sensor**, and cannot be: the frame is
`sandbox="allow-scripts"` with no `allow-same-origin` (opaque origin) and
`allow=""` (every policy-controlled feature off), so `DeviceOrientationEvent` is
unreachable from a pack twice over. `allow="gyroscope; accelerometer"` on the
pack frame was rejected: it hands motion sensors to all twenty-eight installed
packs to serve one, and `frame.ts` says out loud what that line protects.

What crosses the port is two numbers in −1..1 and their angles. A sample says
**which way a marble sitting on the screen would roll**. No compass heading, no
magnetometer, no rotation rate, no acceleration — nothing that could become a
claim about where a child is or which way they are facing.

**Proven by tests, in Node, with no device:** the neutral pose (nobody plays with
a tablet flat on a table), the wrap at ±180 (a device held near the seam that
rocks two degrees must not read as a 358° swing), the re-zero when a tablet is
turned, the dead zone (subtracted, not clipped), the throttle, the change gate,
the null-readings case, the warm-up, the permission refusal paths, the stream
lifecycle end to end over a real `MessagePort`, and that no sensor outlives a
pack.

**Not proven, and needs hardware:**

- **Whether `deviceorientation` fires at all inside iOS WKWebView.** Quite
  possibly it does not: `requestPermission` may be absent, may resolve `denied`
  regardless, and motion in a WKWebView has historically needed app
  configuration Tauri does not expose. Every branch treats that as absence.
- **`SCREEN_ROTATION`** — the four signs mapping the device's frame onto the
  screen's are read off the Screen Orientation specification, not measured. It is
  deliberately one table with four one-line rows so a correction from a device is
  a one-line change with a failing test to point at. Portrait (`angle` 0) is the
  row every other claim rests on.

**The source today is a web API, not a plugin, and that is a first step rather
than the finished shape.** `OrientationPorts` is the interface a
`tauri-plugin-orientation` reading CoreMotion and Android's `SensorManager`
implements, and nothing above `app/platform.ts` changes when it lands. This
capability therefore adds **zero new Tauri IPC surface** — no command, no
`capabilities/default.json` entry, no Rust. The first native capability that does
hits every trap in the checklist below.

---

## Worked example: text to speech

`tauri-plugin-tts` already exists in `corpan/plugins/`. The shape it would take:

```ts
{
  id: "speech",
  methods: ["speech.say"],
  label: "Read words out loud",
  budgetMs: 10_000,   // a voice may have to be loaded
  native: true,
}
```

`speech.say` is a **stream method**: `{ stream }` back immediately, then
`{ seq, data: { boundary: "word", index: 4 } }` as it speaks, then
`{ done: true, reason: "complete" }` when the utterance finishes. `stream.cancel`
is how a child leaving a screen stops a voice mid-sentence — which is the whole
reason cancellation is ungated.

What the shape forces you to get right:

- **Absence is normal.** A device with no voice for the child's locale is not an
  error. `available()` asks the plugin for the voice list at startup; a locale
  with no voice is `speech` unavailable, and a game that drew a "read it to me"
  button without checking `host.available("speech")` has drawn a lie.
- **`pause` must stop the voice.** Suspending *delivery* is not enough here: the
  audio is native and does not care about the port. This is the first capability
  where `setPaused` has to reach through to the source, and the `Bridge` should
  grow a `suspend`/`resume` on the source rather than only gating `emit`. **Write
  that down when you build it; the current `setPaused` only drops messages.**
- **One utterance at a time, or `MAX_OPEN_STREAMS` is the wrong bound.** Four
  concurrent voices is four voices.

## Worked example: an on-device model

```ts
{
  id: "llm.generate",
  methods: ["llm.generate"],
  label: "Make up new puzzles on this device",
  budgetMs: 30_000,
  native: true,
}
```

Streams tokens; `stream.cancel` when the child leaves. Reuse Corpán's RAM
tiering (a 4B model silently OOM-crashed low-memory phones — that is a real
incident, not a hypothesis), so `available()` is **RAM-tiered**: the same build
on two tablets answers differently, which is exactly why availability is a
runtime fact and not a build constant.

Three constraints that are the product rather than the plumbing:

- **A wrong sentence must be harmless where it is used.** ADR-0021 already says
  this. The model never decides whether a child's answer is right — the host owns
  the mathematics (ADR-0023) and `items.answer` is the only judge.
- **Never on the critical path.** A child waiting thirty seconds for a question
  is a child who has left. Generate ahead, behind a `Random` fallback that is
  already good enough for almost everything.
- **The budget is a real deadline, not a formality.** 30s is the ceiling in the
  table; a game should be asking with much less patience than that and drawing
  something else meanwhile.

---

## Worked example: networking, a leaderboard, and ARENA

**Design only. Nothing here is built, and one part of it is a product decision
rather than an engineering one.**

### Can a pack open a socket today? No — verified

The answer is no, and the reason is worth knowing exactly, because it is one line
of Rust rather than an emergent property.

A pack document is served by the app's own scheme handler, which sets the pack's
CSP explicitly — `dynawalla-app/src-tauri/src/packs/mod.rs`, `pack_csp()`:

```
default-src 'none'; … connect-src dynawalla-pack: http://dynawalla-pack.localhost; …
```

`connect-src` is the directive that governs `WebSocket` as well as `fetch` and
`XHR`, it is explicitly set (so there is no `default-src` fallback to argue
about), and it names no remote origin and no `ws:`/`wss:` source. A
`new WebSocket("wss://…")` inside a pack is refused by the WebView.

Three corrections to the obvious reading of this:

- **It is the *pack's* CSP that closes it, not the app's.** A nested browsing
  context does not inherit its parent's policy; a document loaded from
  `dynawalla-pack://` gets the policy in its own response headers. The app's own
  `connect-src` in `tauri.conf.json` is irrelevant to what a pack can reach.
- **The sandbox alone would not have closed it.** `sandbox="allow-scripts"`
  without `allow-same-origin` gives an opaque origin — which means no cookies and
  no credentials, so there is no session a pack could authenticate with — but it
  does not block `WebSocket`. The CSP is the gate.
- **There is no side channel either.** `img-src`/`media-src` admit only the pack
  scheme plus `blob:`/`data:`, `form-action` and `frame-src` are `'none'`, and a
  `blob:` Worker inherits the creating document's policy. A pack cannot
  exfiltrate a score, let alone open a connection.

**This is not a security finding; it is a finding about fragility.** The whole
boundary is that one directive, and the temptation when a leaderboard is wanted
will be to add its origin to it — which grants arbitrary network reach to all
twenty-eight installed packs in order to serve one. Two tests were hardened in
this PR because neither would have caught it:
`src-tauri/src/packs/tests.rs::a_pack_cannot_open_a_socket_either` now pins
`connect-src` to equality, and `src/app/capabilities.test.ts`'s origin scan now
matches `ws:`/`wss:` — it previously matched only `https?://`, so `wss://arena…`
would have gone straight past it in both places.

### So where does the socket live?

**In Rust, and the host owns exactly one connection.** Not merely "should" —
*can only*. The app's own document is under
`connect-src 'self' ipc: http://ipc.localhost`, and `capabilities.test.ts` fails
the build on a remote origin appearing there. Both WebViews are closed by
policy; the only place a socket can exist is the native side, which is also the
only place a credential can be kept out of reach of every pack.

Shape, following everything above:

```ts
{
  id: "contest",
  methods: ["contest.join", "contest.submit"],
  label: "Play against other people and appear on a leaderboard",
  budgetMs: 15_000,
  native: true,
}
```

`contest.join` opens a stream. Everything the server pushes — a rival's score, a
round starting, the board changing — arrives as `StreamUpdate`. `contest.submit`
is an ordinary request/response.

### Does the capability shape actually hold up here?

Point by point, because if it does not, it is the wrong shape and better to know
now.

- **Long-lived connection state.** Held by the host, in Rust, for the app rather
  than for a pack. A stream is a *view* of it: two packs joining get two streams
  over one socket, and a pack's stream ending never closes the socket. The
  envelope needs nothing new.
- **Server-pushed events.** `StreamUpdate` with no request in flight is exactly
  this. This is the case the old seam could not express at all.
- **Reconnection and offline.** The gap the envelope does *not* currently cover.
  A stream has exactly one end, so "the socket dropped and is retrying" cannot be
  `StreamEnd` — that would tell a pack the contest is over when it is not. It
  needs a **liveness value inside the stream**, not a new envelope: every update
  carries `{ state: "live" | "reconnecting" | "offline", … }`, and the pack draws
  the leaderboard greyed rather than gone. **A leaderboard must never lie**: a
  stale board shown as current is worse than one shown as stale, and a child on a
  phone in a car loses signal every few minutes. Corpán's rule applies directly —
  *never block an offline subscriber* — so a child who is offline keeps playing
  and keeps earning, and their score reconciles when the socket returns.
- **Authenticated identity.** No existing capability needs one, and this is where
  the design has to be deliberate rather than incremental. The credential lives in
  Rust and **never crosses the port**. A pack is never given a token; it gets a
  stream. This falls out of the shape rather than being bolted on, and it is the
  strongest argument for the host owning the connection.
- **A shared clock.** The server's, carried in the stream, never the device's. A
  device clock is a thing a child can change, and any time-ranked score computed
  from one is a score computed from a setting.
- **Backpressure.** `MAX_REQUESTS_PER_SECOND` (120) already bounds what a pack
  can send *to the host*, and it is far too generous for something that leaves
  the device. A network capability needs its own, much smaller budget —
  submissions are per-answer, not per-frame — and the host must coalesce rather
  than forward. Worth a `submitsPerMinute` on the capability row, in the same
  spirit as `budgetMs`.

**Verdict: the shape holds, with one addition** — a liveness field inside a
stream's payload, so that "degraded" is expressible without ending the stream.
That is a payload convention rather than a protocol change, and naming it here is
the point of writing the example down before building it.

### Two things for the founder to decide, not for us

**1. A leaderboard in a children's product is a compliance decision before it is
an engineering one.** Real players means visible handles. Scores are innocuous;
names, chat and free text are not, and collecting anything identifying from
under-13s carries real regulatory weight (COPPA in the US, and ADR-0001's Kids
Category posture is still open at `G-01`). A **scores-and-a-chosen-handle-only**
surface with no free text, no chat, no avatars and no way for one child to send
another child anything is a very different product from anything social — and it
is achievable. Handles drawn from a generated word list rather than typed removes
the last free-text field. This should be chosen deliberately now rather than
discovered at submission.

**2. Infinite thinking time and a live leaderboard are in tension, and the
tension is the good part.** The founder wants both: *"infinite time for the
problems even to the point of stepping away and working on it for a few
minutes"* and real-time competition. Ranking by throughput destroys exactly the
behaviour he is trying to reward — a child who spends eleven minutes doing long
division on paper would be beaten by one tapping single-digit sums.

The observation that resolves it: **rank by difficulty conquered, not by rate.**
`Item.difficulty` is already a 0..1 ordinate across the host's whole ladder and
already relative, so it already moves as the curriculum grows. A board ranked on
the hardest thing a child has *correctly* answered, with volume as the
tiebreaker, pays for the eleven minutes and pays nothing for speed. Time can
still matter without being the ranking — a per-item stopwatch shown to nobody but
the child, as a personal best.

That is a design opinion, offered rather than decided. What the doc is asserting
is narrower: **whatever the ranking is, it must not be throughput**, or the
feature undoes the behaviour it exists to reward.

---

## Checklist for adding a native capability

1. **A row in `packs/sdk/src/capabilities.ts`** with `native: true`, a
   `budgetMs`, a parent-readable `label` (`labelOf` is asserted to be a sentence,
   not jargon), and its methods. Add streaming methods to `STREAM_METHODS`.
2. **A branch in `HostServices`** (`bridge.ts`) and a dispatch arm. Streaming
   ones go through `openStream`, which already handles the quota, the cancel
   arriving during a permission prompt, and the source refusing.
3. **An entry in `services.ts`'s availability `Record`.** It will not compile
   without one — that is deliberate.
4. **Add it to `HOST_SUPPORTS`.** Never remove it later to describe a device.
5. **Bump `SDK_VERSION`'s minor.** Not `PROTOCOL_VERSION`, unless an envelope
   shape changed in a way an old pack would misread.
6. **A port, in `app/platform.ts`,** so the decision is testable in Node with no
   WebView. Follow `HapticPorts` and `OrientationPorts`: required rather than
   defaulted at the call site, because a defaulted port makes "nobody wired it"
   compile and look exactly like a device that cannot.
7. **A guest surface that cannot throw.** Absence is not an error path.
8. **If it needs consent, the host asks it, on a gesture, in the host's
   document.** Never from a pack.

### The traps, when it becomes a real plugin

None of these bite the orientation capability, because it adds no IPC. All of
them bite the first one that does.

- **A Tauri plugin needs a capability grant.** Registering the plugin is not
  enough: without an entry in `src-tauri/capabilities/default.json` the invoke is
  **denied at runtime** with everything compiling perfectly. Grant the single
  command (`tts:allow-speak`), never `<plugin>:default` — `capabilities.test.ts`
  fails the build on `:default` and on a grant/call mismatch in either direction.
  Add the row to `src/app/permissions.ts` in the same commit.
- **The Rust wire format silently drops unknown serde fields, in both
  directions.** A field added on one side vanishes with no error. Round-trip it
  in a test.
- **`links =` must be unique** across every crate in the graph. Two crates
  declaring the same value is a hard resolve error that often surfaces only on
  device. Every plugin here uses `links = "<crate-name>"`.
- **Never add a `[workspace]` and never move a `[patch]`.** ADR-0011.
  `dynawalla-app/src-tauri/Cargo.toml` is its own implicit workspace root, and
  hoisting either app's patches into a shared one silently reverts Corpán to an
  `ndk-context` that aborts on Android Activity recreation — compiling, testing
  and clippying clean the whole way. `capabilities.test.ts` asserts the absence
  of a `[workspace]` section here.
- **`cargo check` both shipping targets.** `#[cfg(target_os = "android")]` and
  `ios` arms are where the JNI and Swift bridges live and they are not compiled
  on macOS. Nothing in CI builds Android at all.

## Files

| | |
|---|---|
| The capability table, budgets, stream methods | `packs/sdk/src/capabilities.ts` |
| Envelopes, guards, the `Orientation` payload and its constants | `packs/sdk/src/protocol.ts` |
| The pack's client: deadlines, stream demux, `tilt`, the loud lines | `packs/sdk/src/guest.ts` |
| The enforcement point: gating, streams, pause, teardown | `dynawalla-app/src/packs/bridge.ts` |
| The sandbox, the handshake, `Connect.available`, teardown | `dynawalla-app/src/packs/frame.ts` |
| Availability, and the native surface implemented | `dynawalla-app/src/packs/services.ts` |
| The tilt itself: neutral pose, wrap, screen rotation, throttle, warm-up | `dynawalla-app/src/packs/orientation.ts` |
| The ports, and the permission asked on a gesture | `dynawalla-app/src/app/platform.ts` |
| What the build supports (never what a device supports) | `dynawalla-app/src/packs/library.ts` |
| The pack's CSP — the network boundary, in one directive | `dynawalla-app/src-tauri/src/packs/mod.rs` |
