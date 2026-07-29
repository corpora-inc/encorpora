# `@dynawalla/pack-sdk`

The contract between the Dynawalla host and a pack. One copy, imported by both
sides, so a change that would break a pack cannot typecheck in the host either.

Packs are the product. The host is a shell: profiles, storage, the pack
registry, the runtime, and the adaptive model that decides what a child should
practise next. Every game, world, exercise, sound and asset lives in a pack.

---

## The shape of a pack

A pack is a directory with a `manifest.json` at its root and an HTML document as
its entry.

```
abacus-tower/
  manifest.json
  index.html          ← the entry. It is FRAMED, never evaluated.
  pack.js
  pack.css
  assets/…
```

It is served from `dynawalla-pack://localhost/<id>/…` and framed with
`sandbox="allow-scripts"` — deliberately **without** `allow-same-origin`. That
one omission is the whole security model:

- the frame's origin is opaque, so `window.parent` is cross-origin and
  unreadable. A pack cannot reach the native bridge, the app's stores, or
  another pack.
- there is no `localStorage`, no `IndexedDB`, no cookies. Anything a pack keeps
  is kept for it by the host, through the `storage` capability.
- the document is served with a Content Security Policy that names only the pack
  scheme. **A pack cannot reach the network.** Not "should not" — cannot.
- top-level navigation is blocked. A pack cannot replace the app.

What a pack gets instead is one `MessagePort`, handed over at the end of a
handshake, and everything on that port is validated and gated by the host.

Two consequences worth planning around:

- **Inline `<script>` and `onclick=` are dropped.** `script-src` has no
  `'unsafe-inline'`. Put your code in a file.
- **`'self'` does not work in your own CSS or CSP.** An opaque origin matches
  nothing. Use relative URLs, which resolve against the document, and they are
  fine.

---

## The manifest

```json
{
  "schema": 1,
  "id": "abacus.tower",
  "version": "1.2.0",
  "name": "Abacus Tower",
  "description": "Carry beads up the tower.",
  "sdk": "1.0.0",
  "host": { "min": "0.3.0", "max": "1.0.0" },
  "entry": "index.html",
  "capabilities": ["items", "haptics"],
  "covers": { "skills": ["add.2digit.regroup"], "grades": [1, 3] },
  "minAge": 6,
  "locales": ["en", "es"],
  "assets": { "files": 42, "bytes": 3000000 },
  "download": {
    "url": "https://encorpora.io/dynawalla/packs/abacus-tower-1.2.0.zip",
    "bytes": 900000,
    "sha256": "…64 hex…"
  }
}
```

Notes that are not obvious from the shape:

- `id` is the on-disk directory name and a public identifier forever. Lower
  case, dotted or hyphenated, starting with a letter.
- `host.min` is inclusive and `host.max` is exclusive. There are no npm ranges,
  no `^`, no `~`, and no unions.
- `assets.bytes` and `download.bytes` are shown to a parent **before** anything
  is downloaded. `dw-pack check` fails if the directory is bigger than declared.
- `download.sha256` is verified in Rust against the bytes that arrive, before a
  single entry is extracted. A published artefact is immutable: to change a
  pack, bump the version. Never replace a published file in place — that
  produces two different hashes for one version number and is unresolvable from
  the device.
- `covers` is how the host routes a skill to a pack that can teach it.
- `minAge` is optional, an integer in 3–18, and a **floor with no ceiling** —
  `6` is drawn as `6+`. There is no `maxAge` and the parser rejects one: every
  game's mathematics adapts upward without bound, so a range would print a
  promise the product does not make. It is a claim about **motor and attention
  demand, not about arithmetic** — the maths adapts down to single-digit facts
  in every pack, so it is never the limiting factor. **Guidance, never a
  gate:** nothing in the host reads it to lock, hide, dim or reorder a pack.

---

## Talking to the host

```ts
import { connect } from "@dynawalla/pack-sdk"

const host = await connect()

const item = await host.nextItem()
// { id, skillId, operands: ["5001", "2798"], operator: "−", prompt, digits: 4 }

const judgement = await host.answer({
  itemId: item.id,
  response: typed,
  latencyMs: elapsed,
})
// { correct: false, canonical: "2203", diagnosis: "smaller-from-larger", advance: true }
```

### The pack does not do the arithmetic

`items.next` does not carry the answer. `items.answer` records the attempt and
*then* returns the canonical value — so there is no way to learn what is correct
without spending the attempt you would have had to report anyway.

This is the point of the whole contract. A mathematics game that decides for
itself whether a child was right is a game that can be beaten by fiddling with
the game. The adaptive model chooses the item, the curriculum judges the answer,
and neither of them is inside your pack.

Every operand and every answer is a **string**, and it is exact. The curriculum
computes in rationals. Parsing one into a `number` to lay it out introduces the
first floating-point error in the system; use `digits` for layout and `BigInt`
if you must compute.

`items.reveal` exists for a game that has to place the correct target before the
child reaches it — a runner that must know which gate is right. It is a separate
declared capability, it is shown to the parent, and it changes nothing about who
judges.

### Capabilities

Declare only what you use. A method whose capability you did not declare fails
locally in the client, without a round trip.

| capability     | what it lets you do                                    |
| -------------- | ------------------------------------------------------ |
| `items`        | ask for questions, report answers, skip                |
| `items.reveal` | read the answer before it is answered                  |
| `learner.read` | read which topics have been practised                  |
| `haptics`      | `host.haptic("seat")`                                   |
| `audio`        | `host.sound("settle")`                                  |
| `milestones`   | `host.milestone("tower.built")`                         |
| `storage`      | 200 keys, 16 KB per value, scoped to your pack          |

`host.progress(fraction)`, `host.end(reason)` and `host.transition(kind)` need
no capability: they are how a session is a session.

### `host.transition` — say when your game reached a natural ending

```ts
host.transition("level", "level 3")   // or "run", or "boss"
```

**Call it whenever the child *finishes* something** — a level cleared, a run
completed, a boss down. Fire and forget: it resolves immediately, tells you
nothing, and you must not await it, branch on it, or pause for it. If the host
puts something over your frame you will hear about it through the `pause` event
you already handle.

**Never call it after a failure.** Not a defeat, not a breach, not a wrong
answer, not a timer running out. The host may show a purchase surface at a
transition, and a purchase surface next to a failure is forbidden outright
([ADR-0013](../../docs/DECISIONS/ADR-0013-monetization-model.md)).

Call it as often as your game naturally reaches one — the host acts on the first
per game per day and ignores the rest, so you do not have to ration them or work
out which is special. This is what the day pass
([ADR-0024](../../docs/DECISIONS/ADR-0024-day-pass-not-subscription.md)) is
built on, and it is the reason **there is no timer anywhere in this product**:
a child stops at a place they reached, not at a number.

Read `host.granted` and hide the surfaces you cannot drive. `host.settings`
carries the locale, `prefers-reduced-motion`, a quality tier, the text scale and
the colour scheme, and it follows the host — re-read it on the `settings` event.

### Rules the host will hold you to

- **120 requests per second.** Above that you get `rate_limited`. This is far
  above any real surface and far below a loop.
- **Reduced motion loses no information.** If motion carries meaning, carry it
  another way as well.
- **Nothing by colour alone**, a keyboard path to everything, child-sized
  targets, and 320 px with no horizontal overflow.

### Double-tap zoom is handled for you

A pack is framed, and an iframe has no viewport of its own — so a double tap
inside your game scales the **host** page, and neither your `<meta viewport>`
nor your `touch-action: none` stops it. `connect()` installs a guard for this
before it does anything else, in `tapzoom.ts`. Your game does not call it, does
not configure it, and cannot forget it.

What that costs you: nothing, on purpose. The guard cancels the second and later
taps of a rapid chain — which is the only way to stop the zoom — and then
re-dispatches the `click` the cancellation swallowed, so a control bound to
`click` still fires on every tap. Read `tapzoom.ts` before you build anything
that depends on the exact ordering of `touchend` and `click`.

---

## Developing a pack

```
node bin/dw-pack.mjs check <dir>    # validate against the schema
node bin/dw-pack.mjs serve <dir>    # play it, at http://127.0.0.1:1425
```

`serve` frames your pack exactly as the shipped runtime does — same
`sandbox="allow-scripts"`, same style of CSP — against a mock host. The two
failures that would otherwise only show up on a device (an inline script the
policy refuses, and code that assumes `window.parent` is reachable) happen on
your first run instead.

The mock host **answers** the protocol; it does not **enforce** it. Capability
denial, rate limiting and parameter validation live in the app's `bridge.ts` and
are tested there. `check` is the gate; `serve` is the workbench.

`example/` is the smallest thing that is a pack: four files, no build step, and
it plays. It is the SDK's own smoke test and is never shipped.

## Testing

```
npm test        # node --test over src/**/*.test.ts
npm run tsc
```
