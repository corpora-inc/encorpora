# 23. 3D and Creative

## What it is

Creative-coding libraries are the engines that drive the
non-reading packs. Where Earthgate Reader and Stargate Reader
render text and audio (sections 13, 15), Hover Runner and Juice
Squeeze render 3D scenes; Quest-Ear is a 2D arcade game; Melopán
(currently on a branch) is a generative music sandbox. Each pack
picks the engine that fits its experience and otherwise stays
inside the same SDK contract (section 12) as every other pack.

Three engines appear in the tree as of `main`:

- **Babylon.js** (`@babylonjs/core` and `@babylonjs/loaders`,
  version 6.48): the WebGL-based 3D scene graph that Hover
  Runner and Juice Squeeze build their worlds in.
- **Phaser** (`phaser` 3.80): the 2D arcade-game framework that
  Quest-Ear runs on.
- **Tone.js** (referenced in Melopán's auto-memory note): the
  Web Audio framework Melopán uses for its aux-send delay /
  reverb architecture. Not present on `main` today; the
  Melopán branch is where it lives.

A fourth tool sits adjacent: **Blender**, driven from Python
build scripts in some packs to convert vector source assets
into GLTF / GLB meshes the engine loads at runtime.

## How it fits

These engines do not replace the SDK; they live inside it. Hover
Runner's `mount(container, hostApi)` creates a Babylon canvas
inside the container and runs the scene against the same
`hostApi` every other pack consumes. Quest-Ear's `mount(...)`
creates a Phaser game inside the container. The host does not
know any of this; the container is opaque from its side. From
the pack's side, the engine is just a UI library.

The engines are also where the line between "pack" and "shared
UI" lives differently from the catalog packs. Catalog packs
reach into `corpan/packs/shared/{ui,audio,catalog,state,data,core}`
for the chrome; 3D and creative packs typically import only
`@shared/sdk` for the contract and then build their own scene,
audio, and state systems on top of the chosen engine.

## Files and entry points

- `corpan/packs/hover-runner/`: the reference 3D pack. Babylon
  scene; SVG-to-GLB build pipeline.
  - `package.json` declares `@babylonjs/core` and
    `@babylonjs/loaders` as dependencies and `build:models` as
    a `blender --background --python` script.
  - `scripts/svg_to_3d_v2.py`: converts the Corpán logo SVG
    into a hierarchical GLB with an `EarPivot` node, using
    Blender as a CAD backend.
  - `src/core/`, `src/gameplay/`, `src/rendering/`,
    `src/audio.ts`: the gameplay loop and scene composition.
  - `src/assets/models/corpan_logo.glb`: the build output.
- `corpan/packs/juice-squeeze/`: Babylon scene, same engine,
  different gameplay.
- `corpan/packs/quest-ear/`: Phaser 3.80. `src/engine/`,
  `src/game/`, `src/data/` for the corpus side.
- `corpan/packs/melopan/` (on the `melopan` branch, not on
  `main`): the Tone.js sandbox. The auto-memory note
  `melopan-2026-05.md` records the v0.2.6 architecture and
  the HMR gotcha.
- Babylon.js documentation at `doc.babylonjs.com` and Phaser at
  `phaser.io` are the authoritative references; this section
  is a map, not a tutorial.

## How it works

### Babylon.js as a scene graph

Babylon.js is a JavaScript library that wraps WebGL into a
scene-graph API. A pack creates a `Scene` against a `<canvas>`
and an `Engine`, then populates the scene with `Mesh` nodes,
`Camera`s, `Light`s, and `Material`s. The engine runs a render
loop: `engine.runRenderLoop(() => scene.render())`. Each frame,
Babylon walks the scene tree, computes transforms, batches the
GPU draw calls, and presents the result.

Hover Runner's render loop is the canonical Babylon shape inside
a pack:

```ts
const canvas = document.createElement("canvas")
container.appendChild(canvas)
const engine = new BABYLON.Engine(canvas, true)
const scene = new BABYLON.Scene(engine)
// ... add camera, lights, meshes ...
engine.runRenderLoop(() => scene.render())
window.addEventListener("resize", () => engine.resize())
return {
    unmount() {
        engine.dispose()
        canvas.remove()
    },
}
```

The `unmount` returned to the host is the disposal path. Babylon
hangs onto WebGL resources (textures, buffers, shaders) until
`scene.dispose()` and `engine.dispose()` are called; failing to
dispose them on pack swap leaks GPU memory until the WebView
process restarts.

### The SVG-to-GLB build pipeline

Hover Runner's `build:models` script is one of the more unusual
pieces in the codebase. The brand mark
(`corpan/logo_mesh_hifi.svg`, hand-edited vector art) is the
source of truth; the pack ships a 3D GLB derived from it;
Babylon loads the GLB at runtime. The conversion runs in
Blender:

```
blender --background --python scripts/svg_to_3d_v2.py
```

Blender headless-imports the SVG as curves, extrudes them into
meshes, applies the coordinate-system transforms the script's
top-of-file comment documents (Blender Z-up vs glTF Y-up; the
script rotates +90 degrees around X to neutralize), and exports
to `src/assets/models/corpan_logo.glb`.

The pipeline encodes several pieces of working knowledge in
its docstring: the coordinate policy, the per-mesh sizing
constants (`TARGET_PYRAMID_WIDTH = 1.35`), the named pivots
(`EarPivot` above the pyramid), and the final filename
(`corpan_logo.glb`). The Python is short enough (a few hundred
lines) that the script is its own documentation.

The build runs on a developer's laptop with Blender installed;
CI does not run it. The artifact (the GLB) is committed to the
pack so the runtime build does not depend on Blender.

### Phaser as a 2D game framework

Phaser is the 2D equivalent of Babylon. A Phaser pack creates a
`Game` instance with a config (renderer, scale mode, scenes)
and Phaser owns the canvas, the input handling, the sprite
batching, and the audio. Quest-Ear's scene tree is a small set
of Phaser `Scene` subclasses (a title scene, a gameplay scene,
a boss-arena scene per the auto-memory's v0.4.0 note), each
with its own `preload()`, `create()`, and `update(time, delta)`
methods.

Phaser plays well with the pack contract because its lifecycle
maps cleanly onto `mount`/`unmount`:

```ts
const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: container,
    width, height,
    scene: [TitleScene, ActionScene, BossArenaScene],
})
return { unmount() { game.destroy(true) } }
```

`game.destroy(true)` (where `true` removes the canvas from the
parent) is Phaser's idiomatic cleanup. Same discipline as
Babylon: dispose explicitly, or leak.

### Tone.js (Melopán, off-branch)

Tone.js is a higher-level layer over the Web Audio API. It
exposes typed synths (`PolySynth`, `MonoSynth`,
`MetalSynth`), effects (`Reverb`, `FeedbackDelay`,
`Compressor`), and a transport (`Tone.Transport`) that
schedules events on the audio clock instead of the DOM clock.

Melopán's auto-memory note describes an aux-send delay / reverb
architecture: synth voices route their dry signal to the
destination and a wet send to a `Reverb` / `FeedbackDelay` bus,
which itself routes to the destination. This is the standard
analog-mixer pattern in code.

Two practical notes from the auto-memory:

- **HMR gotcha**: hot reload re-runs the module that constructs
  `Tone` instances, leaving the previous instance still
  scheduled on the transport. The fix is the same as the
  Babylon dispose discipline: tear down before re-creating.
- **iOS WebKit codec gotcha**: see section 18. Opus-in-OGG
  silently fails to decode on iOS WebKit < 17; in-zip vocal
  samples ship as 16-bit PCM WAV.

### Creative-coding as a category

The four engines (Babylon, Phaser, Tone, plus Blender as a
build-side helper) share a conceptual shape that is worth
naming explicitly: each gives the pack a single object that
owns its own clock, its own scene graph or state machine, and
its own canvas or audio context. The pack constructs the
object on `mount` and disposes it on `unmount`. The host has
no business inside.

This is why the pack contract (section 12) is the shape it is.
A contract that surfaced the engine's internals to the host
would either force every pack to use the same engine or surface
the choice into the contract. Keeping the engine opaque and
exposing only the small HostApi is what lets Babylon, Phaser,
Tone, and any future engine coexist inside the same Corpán
app.

### Why these engines and not others

- **Babylon.js over Three.js**: Babylon ships a fuller default
  set (`@babylonjs/loaders`, physics integrations,
  TypeScript-first docs) that fits the "scene plus a few input
  handlers" pattern the 3D packs need. Three.js is the more
  popular choice, but its docs assume more boilerplate.
- **Phaser over a custom 2D engine**: Phaser is mature, has
  built-in physics (Arcade), sprite batching, and input
  handling. Quest-Ear is the kind of arcade game Phaser was
  designed for.
- **Tone.js over raw Web Audio**: Tone wraps the Web Audio
  scheduling primitives in a transport-based API. Melopán
  reaches for it because its musical-time scheduling is
  intrinsic; a raw Web Audio implementation would re-derive
  the same primitives.
- **Blender over a JS SVG-to-mesh library**: Blender is the
  reference 3D modeling tool. The CLI runs scripts headless;
  the model fidelity is what would otherwise require
  per-pack-developer time. Keeping the conversion in Python
  with Blender as the runtime is the pattern the team
  invested in.

## Common operations

1. **Add a 3D pack from scratch.** Copy
   `corpan/packs/hover-runner/` as a starting point. Replace
   the manifest id, the build:models pipeline, the asset set,
   and the gameplay code. Keep the dispose discipline.
2. **Rebuild Hover Runner's models.** From the pack directory:
   `npm run build:models` (requires Blender installed and on
   `PATH`). Commit the new GLB.
3. **Add a 2D pack from scratch.** Copy
   `corpan/packs/quest-ear/`. Replace the Phaser scenes; keep
   the SDK plumbing.
4. **Debug a Babylon scene.** Babylon ships an Inspector
   (`scene.debugLayer.show()`). Toggle it from a temporary
   button in the pack during development; remove before ship.
5. **Profile a creative-coding pack's frame.** Chrome / Safari
   DevTools' Performance tab captures the WebGL or Canvas2D
   workload per frame. The audio engines have their own
   audio-render-quantum semantics; the relevant tool is the
   WebAudio tab.
6. **Verify a pack ships on the oldest target iOS.** Section 18
   covers this for audio specifically; the same discipline
   applies to WebGL features (some advanced shaders require
   iOS 16+).

## Why we built it this way

Picking the right engine for each pack is the cost the team is
willing to pay for the experiences each pack is supposed to be.
Forcing every pack into one engine would either over-equip the
2D packs (Babylon for an arcade game) or under-equip the 3D
packs (Phaser for a hover-runner). The HostApi is what makes
the choice scoped to the pack; the engine cost is paid in
bundle size, not in cross-pack coupling.

The Blender-driven SVG-to-GLB pipeline is one of the places the
"plain text travels" principle has to bend. SVG is text; GLB
is binary; the conversion needs Blender. The mitigation is
that the SVG source is committed, the conversion script is
committed, and the GLB output is committed; if Blender's
behavior changes incompatibly, the script is the place to fix
it, not the GLB.

The dispose discipline is a single rule that applies across
every engine: construct on mount, dispose on unmount, nothing
between. The cost (a few lines of explicit teardown per pack)
is invisible; the cost of skipping it (WebGL contexts that
leak, audio voices that double on every reload) is loud.

Creative-coding libraries as opaque to the host is the
extension of the HostApi's "no backdoor" principle (section
12). The host does not know about scene graphs, audio nodes,
or sprite batches. Each pack speaks the small HostApi; the
engine inside the pack is the pack's business. This is the
shape that lets the same Corpán app host a calm audiobook and
a 3D platformer without either having to know about the other.

## To go deeper

- Babylon.js docs at `doc.babylonjs.com`; the "Getting Started"
  page is short.
- Phaser docs at `phaser.io/docs`; the "Making your first game"
  tutorial covers the lifecycle.
- Tone.js docs at `tonejs.github.io`; the "Transport" and
  "Effects" pages cover what Melopán builds on.
- Section 18 for the audio asset format choices that constrain
  what creative-coding packs can bundle.
- The auto-memory notes for the in-flight Melopán and Quest-Ear
  work, which document the per-pack discoveries in more depth
  than this section.
