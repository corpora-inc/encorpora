# The bazaar

The endless minaret-punk marketplace the games are stalls in.

```bash
npm install
npm run dev     # the standalone street, with ten stub stalls
npm test        # 41 gate tests, Node's native runner, no vitest
npm run tsc     # type check
npm run shots   # build, serve, walk the street, screenshot, measure
```

## The thesis

**The bazaar is the frame. The games are the stalls.** An arcade has a look; the
cabinets inside are each their own world. The marketplace carries the identity so
that ten games can look like ten different games and still be one place.

Everything follows from that. The stub previews in `src/demo/previews.ts` are on
purpose *not* minaret-punk — each owns its own ground, palette and type. The
contrast between the frame and the stall interiors is the design.

## Using it

```ts
import { mountBazaar } from "@dynawalla/bazaar";
import "@dynawalla/bazaar/bazaar.css";

const bazaar = mountBazaar(el, {
  stalls: [
    { id: "tessera", title: "Tessera", quarter: "tilers", preview, accretion: 0.4 },
  ],
  dayRemaining: 0.6,          // 0…1 of the free day left
  subscribed: false,
  onEnter: (id) => router.push(`/play/${id}`),
  onUpgrade: () => sheet.open(),
});

// when the game closes, hand the street back:
bazaar.setInStall(false);     // restores scrollLeft within 1px (BZ-08)
```

It is vanilla TypeScript and mounts into any DOM element, so a React host wraps
it in a ref and a `useEffect` in six lines. It was written that way deliberately:
the street is one canvas plus a handful of real DOM nodes at 60 fps, and a
reconciler in that loop earns nothing.

### What a game implements

One interface, and nothing else changes when a real game replaces a stub:

```ts
export interface StallPreview {
  /** Deterministic on seed. No input, no audio, no network, no persistence. */
  render(ctx: CanvasRenderingContext2D, o: PreviewFrame): void;
  /** Loop period in seconds. 4–8. */
  readonly period: number;
}
```

The preview shows the game **being played correctly** — a ghost hand solving, at
half speed. Not a title card, not a logo, not a menu. A child must be able to
tell what they would *do* in there without entering. Budget: 4 ms per frame at
30 fps; over budget and the stall falls back to its poster permanently, silently.

## How it is put together

```
src/
  bazaar.ts            mountBazaar: DOM, input, the loop, the enter/leave dolly
  types.ts             the public contract
  strings.ts           the twelve strings, in en/es/pt-BR/fr/de
  tokens/
    palette.ts         layer 1 materials + layer 2 semantic roles (the source)
    bazaar.css         the same values as custom properties + the DOM layer
    contrast.test.ts   BZ-03: every pair, both themes, the ward L* separations
    tokens.test.ts     BZ-01/BZ-02: three layers, no black, no blur
  geometry/
    pic.ts             Hankin polygons-in-contact — ONE engine, four folds
    tilings.ts         decagon+bow-tie · truncated square · hexagonal · 4.6.12
    pattern.ts         strapwork panels, three LODs, interlace, cached
    zellij.ts          khatem floor with the wear rule (chips, repairs, polish)
    muqarnas.ts        tiers → cells → three FLAT facets, never a gradient
    mashrabiya.ts      five lattice variants, openings graduated by height
    arch.ts            drop arch and equilateral pointed arch, two-centred
    gears.ts           BZ-LAW-11: a follower's angle is derived, not assigned
    girih.test.ts      BZ-04: midpoints, 54°±0.01°, a partner across every edge
  world/
    layout.ts          the modular grid; M is the stall pitch
    street.ts          the generator: stalls, gates, interstitial fabric
    quarters.ts        the ten quarters, and their (ward, finial, fold) triples
    daylight.ts        Ambient × 2 keyframe sets, and the 40 s dusk
    parallax.ts        seven layers, critically damped, centre-anchored
    backdrop.ts        the two canvases and the draw order
    skyline.ts         towers with working instruments · domes · the roofline
    canopy.ts          the arcade overhead, the shafts, the lanterns, the valve
    floor.ts           paving · the water channel · reflections · shadows
    life.ts            the crowd, the cats, the pigeons, the porters, the smoke
    sprites.ts         the sprite cache — the whole performance story
  stall/
    chrome.ts          hood · awning · sign · aperture · counter · shutter
    goods.ts           3–7 real objects from that game, on the sill
    automaton.ts       brass, faceless, performing its own mathematics
    preview.ts         BZ-06: one live preview, an LRU of posters
  lamp/                the daily lamp, and the lamplighter
  finder/astrolabe.ts  search as an instrument; there is no grid view
  sound/bed.ts         WebAudio, zero assets, every sound caused by something
  perf/tiers.ts        the thermal ladder
  demo/                ten stub games and the standalone entry
qa/shots.mjs           BZ-19 screenshots + BZ-12 flash + BZ-18 nodes + fps
docs/AESTHETIC.md      the laws, the gates, and what deviates from the spec
```

Nothing in here imports from `src/work/`, `engine/` or `curriculum/`, and
`tokens.test.ts` fails the build if that ever changes. The bazaar never waits for
the world, and the world never waits for the bazaar.

## The screenshot set

`npm run shots` builds, serves, walks the street and writes ten PNGs plus a
measured `report.json` into `shots/` — which is **git-ignored on purpose**: it is
8 MB of images regenerated by one command, and a public repository's history is
the wrong place for it. The set covers the opening view, mid-street, a stall
close up, the night bazaar, the lamp low at golden hour, the far horizon, 320 px
in both themes, reduced motion, and the scaffolding past the last built quarter.

The same run asserts BZ-12 (flash), BZ-18 (live node count at 60 stalls) and
reports the measured frame times. It exits non-zero on a console error, a flash
violation or a node-count overrun, so it is CI-shaped whenever someone wants to
wire it up.
