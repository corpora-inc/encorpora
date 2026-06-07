# Corpan City — Art & Feel Direction

> Status: living document. The procedural art described here is a **stand-in**.
> Treat every visual as a placeholder for the Spark 2D-sprite pipeline (see
> "The Spark handoff" below). The *direction* is the contract; the pixels are not.

## The one-line vision

A warm paper-cutout, pop-up-storybook plaza you can walk through — a cozy
diorama caught in morning light, where neighbors trade hellos in new languages.
Simple, lovable silhouettes (South-Park-simple, but dignified and warm), never
gritty, never busy. It should feel hand-cut and hand-placed, like someone built
it on a kitchen table out of colored paper and love.

## The signature look

Three pillars, all cheap, all data-driven:

1. **Cut paper, every piece.** Each object — an NPC, a fountain, an awning — is
   a stack of flat paper shapes: a soft contact drop-shadow, a torn cream
   "deckle" rim, the colour fill, then a whisper of top-sheen / bottom-shade so
   the piece reads as gently curved. No gradients-as-realism, no textures
   pretending to be stone. Paper pretending to be stone. (`src/world/cutoutArt.ts`)

2. **2.5D billboards.** Everything is a flat plane that yaw-billboards to face
   the camera while staying upright, grounded by a soft blob shadow. This is the
   whole rendering budget — flat quads + alpha — which is why it holds 60fps on
   phones. (`src/world/billboard.ts`)

3. **Premium air.** The scene is wrapped in atmosphere that does the emotional
   lifting: a painted sky dome with a low warm sun glow, gentle distance fog so
   far cutouts melt into the horizon, a warm light rig with a cool rim, drifting
   dust motes in the light, and a painted vignette that warms the center and
   softens the corners. (`src/world/atmosphere.ts`)

## Palette discipline

A scene carries a tiny palette (`sky`, `ground`, `groundAlt`, `accent`) in its
JSON (`content/scenes/*.json`). **Everything else is derived from those four.**
The atmosphere module computes a single "warm morning" key by blending `accent`
toward gold; that one colour drives the sun glow, fog tint, hemispheric fill,
the rim's complementary cool, and the vignette wash. The result: one coherent
hour of one coherent place, set entirely by four hex values.

Rules of thumb:

- **Accent is sacred.** One pop colour per scene (the café awning, a scarf).
  Everything else is warm neutrals (cream, sand, clay, soft wood).
- **No pure black, no pure white.** Ink is `#2a2018`-ish; paper is `#fdf7ec`-ish.
- **Cheeks and warmth.** Faces get rosy cheeks and a soft smile. Always
  wholesome, always dignified — kids and parents read these.
- **Tints, not new art.** Cosmetics and reskins recolor shared shapes rather
  than adding geometry (see `content/cosmetics/starter.json` `tints`).

## How scenes & eras reskin one topology

The core trick: a **RoomTopology** (`content/topologies/*.json`) is an abstract,
shared space — anchors with positions, roles, facings, plus blockers and spawns.
A **Scene** (`content/scenes/*.json`) is a per-place *skin* that maps each anchor
to a cutout (`anchorSkins`) and optionally an NPC (`npcSkins`), and supplies the
palette + setting (place/era/mood) + narrative blurb.

> Two different Scenes over the *same* topology produce two different worlds at
> identical world positions. Antigua-1770 and (future) Kyoto-1920 can share
> `plaza-sq-a`: same fountain *anchor*, different fountain *art*, different
> palette, different morning. This is the divergence model — author once, reskin
> forever, no new geometry.

Eras change **palette + art ids + mood copy**, never the walkable shape. A new
era is a JSON file, not a build.

## The lighting & particle budget (hold 60fps on phones)

Atmosphere feature-detects a `lean` tier (small viewport or DPR < 2) and scales
down. Hard ceilings:

| Element        | Phone (lean)        | Tablet/Desktop      |
| -------------- | ------------------- | ------------------- |
| Dust motes     | ≤ 60 particles      | ≤ 120 particles     |
| Fog            | EXP2, density ~.012 | EXP2, density ~.016 |
| Sky dome       | 1 sphere, 16 seg    | 1 sphere, 16 seg    |
| Vignette       | 1 cam-locked quad   | 1 cam-locked quad   |
| Lights         | hemi + sun + 1 rim  | hemi + sun + 1 rim  |
| Cutout texture | ≤ 256–384px         | ≤ 256–384px         |
| Post-process   | **none**            | none (optional)     |

Non-negotiables:

- **No post-process pipeline by default.** The vignette is a painted quad, not a
  shader pass — works identically on every GPU, costs one draw.
- **Lights are constant.** Three lights, forever. New mood = retune colours, not
  add lights.
- **Dust is additive + low.** Pre-warmed so it's "already drifting" on arrival;
  never a particle storm.
- **DPR is capped at 2** by the engine; respect it.
- Tablet and desktop are first-class targets (not "phone + scale up"). Evaluate
  the look at iPad and desktop sizes, not just phone.

## The Spark handoff (procedural art is temporary)

`cutoutArt.ts` and the onboarding doll renderer paint shapes with the 2D canvas
**procedurally** so we can build, walk, and feel the world *today* with zero
asset dependency. They are deliberately structured to be thrown away:

- Every drawable resolves through one funnel — `cutoutDraw(id)` returns
  `{ w, h, draw, shadow }`, keyed by the same `placeholder:*` ids the Scene
  JSON already uses (`npc-baker`, `cafe`, `fountain`, …).
- When the **Spark 2D-sprite pipeline** lands, it emits a real sprite atlas +
  a manifest mapping those same ids to atlas regions. `cutoutDraw` becomes an
  atlas blit (`drawImage(atlas, sx, sy, …)`) — same signature, same call sites,
  same plane dims. `billboard.ts`, `sceneRenderer.ts`, and the onboarding doll
  don't change.
- Cosmetics already point at `placeholder:cos-*` `spriteRef.url`s and carry
  `tints`; Spark replaces the procedural layer with real layered sprites keyed
  by the same `CosmeticSlot` + `itemId`, recolored by the same tint.

In short: **the ids and the layering are the durable contract; the brushstrokes
are scaffolding.** Keep new art flowing through `cutoutDraw` / the Scene+Cosmetic
JSON, never hard-coded at a call site, and the Spark swap stays a one-file change.

## Onboarding feel

First run is a short, **skippable**, premium ritual (`src/onboarding/`):
welcome → roll a safe storybook name → dress a paper doll from the free starter
kit → enter. Same paper-cutout language as the world, mobile-first, framer-less
(vanilla DOM + CSS transitions). Names are composed from **fixed curated lists**
(`content/identity/names.json`) — never freeform, never identifying, always
wholesome. The result is validated against the Zod contracts before it can reach
the game.
