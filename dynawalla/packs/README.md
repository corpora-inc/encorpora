# Packs — the SDK, the shared code, and the pipeline

Packs are the product. This directory is everything both sides of that agree
on, plus the one command that turns a game into something installed on a
tablet.

```
packs/
  sdk/                  the host↔pack contract, imported by both sides
  shared/curriculum/    exact-rational, seeded mathematics — the HOST imports this
  shared/game-host/     the guest-side adapter arcade packs mount against
  build.mjs             build + validate + stage every pack
```

---

## The one command

```
cd dynawalla-app && npm run packs
```

It discovers every pack, builds it, generates its manifest, runs the gate, and
stages it. **`npm run tauri dev` runs it first**, so the founder's loop is:

```
cd dynawalla/dynawalla-app && npm run tauri dev
```

and every game is installed and playable when the window opens. No network, no
catalogue, no install step, no download.

What "discovers" means: a pack is **any directory under `games/` with a
`pack.json`**. There is no register to add to. That is the property that has to
hold at a thousand packs, so it holds at two.

### What a pack author writes

`games/<name>/pack.json` — only the things a builder cannot know:

```json
{
  "id": "dynawalla.fuse",
  "version": "0.1.0",
  "name": "FUSE",
  "description": "…",
  "sdk": "1.0.0",
  "host": { "min": "0.1.0", "max": "1.0.0" },
  "entry": "pack.html",
  "capabilities": ["items", "items.reveal", "haptics"],
  "covers": { "skills": ["dw.add.regroup.subtract-multidigit"], "grades": [1, 4] },
  "minAge": 7,
  "locales": ["en"],
  "build": { "config": "vite.pack.config.ts", "out": "dist-pack" }
}
```

`assets.files`, `assets.bytes` and the integrity digest are **generated**. They
are facts about built output, and a hand-maintained copy of a fact goes stale.

### `minAge` — the one judgement a builder cannot make

Every game must state one, and `packs/sdk/src/fleet.test.ts` fails the build if a
new directory arrives without it. It is a **floor with no ceiling**: `7` is drawn
as `7+`, and there is no `maxAge` — the parser rejects one — because every game's
mathematics adapts upward without bound and a range would print a ceiling the
product does not have.

**Judge it by motor and attention demand, never by the arithmetic.** The maths
adapts down to single-digit facts in every pack, so it is never what stops a
five-year-old; what stops them is a 60 ms timing window, two thumbs on two
independent sticks, or steering away from something while computing. Roughly:

| | what the hands must do |
| --- | --- |
| 5 | discrete taps on large targets, self-paced, nothing moving against the child |
| 6 | one forgiving continuous gesture (a drag, a free aim), or a soft budget, no dual task |
| 7 | steer or survive while a question is live, or a window around 200–400 ms, or small targets |
| 8 | two simultaneous continuous axes, or sustained dodge-plus-compute, or a window under 250 ms |
| 9 | all of it at once: precision timing, dual task, and fine discrimination between numerals |

**It is guidance, not a gate.** Nothing anywhere reads this field to lock, hide,
dim or reorder a pack. A five-year-old's parent seeing `8+` is being told the
game may be frustrating; the game still opens, at full strength, on a press.

### Where the output goes

| path | what it is |
| --- | --- |
| `dynawalla-app/src-tauri/packs/<id>/` | what the app installs. Bundled as a Tauri resource; the Rust side syncs it into the pack root at launch. Git-ignored build output. |
| `dist-packs/<id>/` + `dist-packs/catalog.json` | the publishable form. |

A debug build re-copies every bundled pack on every launch, so editing a pack
and restarting is the whole dev loop. A release build only copies when the
version changed.

### What is not here yet: publishing

`dist-packs/` is not uploaded anywhere. `PACK_ORIGIN` in
`src-tauri/src/packs/mod.rs` is pinned at
`https://encorpora.io/dynawalla/packs/` and has nothing on it, so the generated
catalogue carries no `download.url` — which is exactly what the manifest schema
means by "a pack that ships with the app". Turning `dist-packs/` into archives,
uploading them and publishing a catalogue is a release step, and it is the next
one.

---

## The safe area — one call, one name, one gate

Every pack's `pack.html` declares `viewport-fit=cover`. That is not a neutral
setting: it opts the document **into** the notch, the home indicator and the
rounded corners. Something then has to claw those pixels back for anything a
child must read or touch.

The obvious way to do that is `env(safe-area-inset-*)`, and **it does not work
here**. A pack runs in an iframe sandboxed `allow-scripts` with deliberately no
`allow-same-origin`; `env()` belongs to the top-level browsing context, so a
cross-origin child resolves all four to **zero**. Every rule that reaches for one
silently collapses to its fallback. It is perfect in a browser tab and it ships a
HUD under the status bar.

That defect was found five times — SIEGE, MONUMENT, POLARITY, CLAIM and ABYSSAL
BLOOM — each time by the founder, on a device, with a green suite behind it. So
there is now exactly one mechanism and it is not optional.

```ts
import {
  installSafeArea,
  SAFE_VARS,
  type SafeArea,
} from "../../../packs/shared/game-chrome/index.ts"

// At mount, once. Publishes --dw-safe-top/right/bottom/left onto `root` for the
// stylesheet, subscribes for rotation and iPadOS Split View, and calls back with
// the SAME numbers for the canvas — synchronously at mount and again on every
// change.
const safeArea = installSafeArea(root, (insets) => layout(insets))

// In unmount:
safeArea.dispose()
```

The stylesheet reads the published property, never the `env()` behind it:

```css
padding-top: max(12px, var(--dw-safe-top, env(safe-area-inset-top, 0px)));
```

In CSS-in-TS, interpolate `${SAFE_VARS.top}` rather than typing that string.
The `env()` at the end is not a second answer — it is the answer in a dev browser
tab opened straight at `index.html`, which **is** the top-level context and where
`env()` is right.

**Three rules, and `packs/sdk/src/safearea.test.ts` enforces all three on every
pull request, over every pack:**

1. `env(safe-area-inset-` may appear only as the fallback of `--dw-safe-<side>`.
2. Every shipped stylesheet is parsed, cascaded at ten real viewports — including
   the founder's 393×851 phone with its 24px status bar and 48px three-button
   navigation bar — and every edge offset resolved to a **number**, with `env()`
   defined as zero. It fails a value short of the inset, a `padding:` shorthand
   in a media query that resets a longhand, and anything pinned within 64px of a
   single edge that never pays for it. (`.ab-badge { bottom: 6px }` was that last
   one, and it never mentioned the safe area at all, so no text search could have
   found it.)
3. A pack that holds CSS in a TypeScript template literal must **export** it, so
   the gate can import the module and evaluate the same string the browser sees.

The one escape hatch, for a rule that really is positioned inside a container
that already paid:

```css
.cl-fill { --dw-safe-exempt: "inside .cl-meter, which is position:relative" }
```

A declaration rather than a comment, because a CSS parser throws comments away
and an exemption a gate cannot see quietly becomes universal. The reason is the
mechanism: nobody types "this sits inside the navigation bar".

---

## Writing an arcade pack

A game that wants questions mounts `shared/game-host`:

```ts
import { createGameHost } from "../../../packs/shared/game-host/index.ts"

const mounted = await createGameHost({ domain: "add-sub" })
await mounted.warm()          // stocked before the first frame
const game = mount(root, mounted.host)
mounted.client.on("dispose", () => game.unmount())
```

`mounted.host` is **synchronous** — `next()` returns a question inside a
`requestAnimationFrame` loop, from a pool the adapter keeps stocked over the
`MessagePort`. That is the whole reason the adapter exists: the SDK is
asynchronous and a game loop is not.

Three things it does that a game should not do itself:

- **Reports once per item.** A double-reported chip would inflate a child's
  record, and the record only ever rises.
- **Never compares a response to an answer.** `items.answer` is the judge.
  `answer` on a `Question` is the host's `items.reveal`, which is a declared,
  parent-visible capability for placing a target — not a way to score.
- **Reports session progress**, so the host can draw the hairline.
- **Forwards `transition`**, the game's own "the child just finished something"
  signal. Games call `host.transition("level")` synchronously from inside their
  loop; the adapter makes the round trip and swallows any failure. See the SDK
  README, and note the one rule: **never after a failure**.

### The gap worth knowing about

FUSE asks for a chip worth *exactly* a given value so it can print an
expression on its face (`focus({ key, wanted })`). The host cannot generate to a
target answer — the curriculum ships one generator family
(`gen.arith.column-op`, 2–4 digit column add/sub), and `items.next` takes a
skill, not a value. The adapter therefore satisfies `focus` opportunistically,
out of the pool, and FUSE draws a numeral when nothing matches. The game is
fully playable either way; expression faces are more common at higher KEYs,
where the wanted range overlaps what the curriculum produces.

Closing it properly means more generator families — small-number
add/sub/multiply — not a change to the boundary.
