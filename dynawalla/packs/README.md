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
  "locales": ["en"],
  "build": { "config": "vite.pack.config.ts", "out": "dist-pack" }
}
```

`assets.files`, `assets.bytes` and the integrity digest are **generated**. They
are facts about built output, and a hand-maintained copy of a fact goes stale.

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
