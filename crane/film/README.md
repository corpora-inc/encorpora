# Crane lesson films

Lesson films for the crane exam-prep app, made with AMP's lesson-film kit
(`amp/film/`). A film is one JSON screenplay; the kit times it to the
narration, checks it in the 16:9 film and on a phone held upright, and plays it
live from screenplay + timing + narration (about 100 KB a film, no video). Read
[amp/film/AUTHORING.md](../../amp/film/AUTHORING.md) for the screenplay: beats,
the whiteboard, cues on spoken words. This folder adds the crane pictures, the
crane app's look, and the crane screenplays.

| Path | What |
|---|---|
| `concepts/` | Each film's lesson, written first: the idea, the moment, at most three cases. |
| `lessons/<id>.json` | Screenplays (`demo-*` exercise one piece each). |
| `pieces/` | The crane pictures, drawn as a pure function of film time. |
| `mount.ts`, `timeline.ts`, `shot.ts` | A shot's `{"crane": ...}` figure, driven by `crane` actions. |
| `theme.css` | The app's tokens (`crane/app/src/tokens.css`) and Barlow, for the stage and the pieces. |
| `page.tsx` | What the renderer loads for a crane film. |
| `review/` | The review pages: a list, and each film at its own path. |

## Make a film

Once: `npm ci` in `amp/` and in `crane/app/` (the theme takes Barlow from there).
From `amp/`, with media outside Git:

```sh
export FILM_OUT=~/corpora-media/AMP-media/lesson-films/_crane/films
npx tsx film/make.ts <id> --kit crane --dry --board          # free: every check, storyboard.jpg, board/ frames
npx tsx film/make.ts <id> --kit crane --dry --board --tall   # the same on a phone held upright
npx tsx film/make.ts <id> --kit crane --silent               # a silent edition on estimated timing (no voice chosen yet)
npx tsx film/make.ts <id> --kit crane --check --voice narrator=<voice>   # voiced (see voices below)
npx tsx film/export-live.ts --kit crane <review>/data <id>   # screenplay + timing + narration for the player
npx tsc -p ../crane/film                                     # types
```

Review pages: `npx vite build --config ../crane/film/review/vite.config.ts --outDir <dir> --base /lesson-films/crane/`
from `amp/`, data under `<dir>/data/`, and each film at `<dir>/<id>/index.html`
(a copy of `index.html`).

Voices: no crane voice is chosen yet. AMP's voices are people's own voice
clones and stay AMP's until the founder says otherwise. The house voices (`ellis`,
`hazel`; ours, designed, made on the Spark) are free placeholders.

## A crane figure

```json
{ "figure": { "crane": { "boom": { "length": 74, "radius": 20, "load": 18000, "jib": true } } },
  "beats": [ { "say": "Lower the boom, and the hook moves out.", "do": [
    { "do": "crane", "set": { "boom.radius": 45 }, "at": "Lower", "dur": 3.6 } ] } ] }
```

A figure holds one or more pieces by kind (`"arrange": "row"` sets two side by
side). One action, `crane`, drives them:

- `set`: ease named values to new ones over `dur` (`{"boom.radius": 45}`).
- `show` / `hide`: fade parts. A name covers what is under it (`boom` is the whole piece). A spec's `hidden` lists parts that wait for `show`.
- `light`: the amber light on parts, from its word to `until` (or the beat's end).

`--dry` names any part, value or spec field a piece does not have. Charts are
our own fictional ones (`crane/content/tools/loadcharts`), never a
manufacturer's.

| Piece | Shows | Values | Parts |
|---|---|---|---|
| `boom` | A truck crane on outriggers from the side, to scale: telescopic boom at a radius, hook block, slings, load, stowed extension, the radius dimension and a strip reading boom, radius, angle and the chart's gross capacity. Spec: `chart`, `config`, `length`, `radius`, `load`, `jib`, `rigging`, `readouts`. | `boom.radius`, `boom.length` | `boom.crane`, `.sections`, `.axis`, `.radius`, `.line`, `.block`, `.slings`, `.load`, `.jib`, `.readout.<boom\|radius\|angle\|capacity>` |
| `chart` | A load chart page: boom lengths across, radii down, gross capacities, strength-limited cells shaded with a bold line, blank cells as a dash; pointers for a value between rows or columns; the notes under the chart. Spec: `chart`, `config`, `booms`, `radii`, `marks`, `notes` (`gross`, `radius`, `boom`, `blank`, `shaded`, `stowed`). | `chart.rmark`, `chart.bmark` | `chart.title`, `.booms`, `.radii`, `.col.<boom>`, `.row.<radius>`, `.cell.<radius>.<boom>`, `.shade`, `.rmark`, `.bmark`, `.notes`, `.note.<key>` |
| `reeving` | Boom-tip and block sheaves with one rope: each part of line, the lead line to the drum, the dead end; readouts of parts, load per part, line capacity and the check. Spec: `parts`, `load`, `linePull`, `deadEnd`, `readouts`. | `reeving.parts`, `reeving.load` | `reeving.tip`, `.block`, `.part.<n>`, `.tension`, `.lead`, `.rope`, `.deadend`, `.load`, `.readout.<parts\|perpart\|capacity\|check>` |
| `slings` | A two-leg bridle: angle arcs from the horizontal, H and L dimensioned, tension per leg = share × L ÷ H. Spec: `load`, `leg` or `spread`, `angle`, `readouts`. | `slings.angle` | `slings.hook`, `.legs`, `.leg.<1\|2>`, `.angle`, `.height`, `.length`, `.load`, `.pull`, `.readout.<angle\|factor\|tension>` |
| `base` | Stability. `view: "side"`: the tipping axis as a fulcrum under the near float, the crane's weight at its center of gravity and the load's at the hook, both lever arms dimensioned, and a panel of crane × arm against load × arm with bars to one scale (tipping = craneWeight × (cg + axis) ÷ (radius − axis); `rated: true` adds 85% of it). `view: "plan"`: floats, the boom's swing and the four candidate tipping axes, the one the boom crosses drawn solid. Spec: `view`, `craneWeight`, `cg`, `radius`, `load`, `axis`, `tilt`, `swing`, `front`, `rear`, `rated`. | `base.radius`, `base.load`, `base.axis`, `base.tilt`, `base.swing` | side: `base.crane`, `.boom`, `.outriggers`, `.center`, `.axis`, `.cg`, `.rigging`, `.load`, `.armCrane`, `.armLoad`, `.moments(.crane\|.load)`, `.tipping`, `.rated`; plan: `base.float.<fl\|fr\|rl\|rr>`, `.axis.<front\|rear\|left\|right>`, `.axisDim` |
| `clearance` | Power lines from above: the work zone as the circle of maximum working radius, the boom at a swing, the line with its voltage, its clearance band (20 ft for §1926.1408(a)(2), or Table A by `kv` from `crane/content/tools/powerline`), the overlap in red and the gap readout. Spec: `maxRadius`, `line`, `clearance`, `kv`, `voltage`, `swing`, `reach`, `readouts`. | `clearance.reach`, `clearance.swing`, `clearance.line` | `clearance.crane`, `.zone`, `.radius`, `.boom`, `.line`, `.voltage`, `.band`, `.overlap`, `.gap`, `.limit` |

## In the app (plan)

1. **Pack.** Each film's export (screenplay with timing, about 35 KB, and AAC
   narration, 60 to 200 KB) ships in the crane content pack as rows of a `film`
   table: `film_id`, `skill_ids`, `topic_id`, `title`, `seconds`, the JSON and the
   audio blob, with the same provenance and SHA-256 verification as every pack
   row. Offline by construction; no video.
2. **Player.** The app mounts `amp/film/player.ts` with `mountFigure` set to
   `crane/film/shot.ts`, as `review/review.tsx` does. Before it ships, the player
   module is split so a crane build does not carry AMP's app figures (today
   that is about 1.4 MB of the review bundle).
3. **Learn.** A topic and a lesson list their films first ("Watch: Reading a load
   chart, 2:42"); a film opens as a full-screen overlay at its own URL
   (`/learn/film/<id>`), so Back, refresh and links work and ✕ returns to the
   screen behind it.
4. **After a wrong answer.** Practice feedback for an item whose skill has a film
   shows one action, "Watch the 2-minute lesson", under the rationale. It opens
   the same overlay; closing it returns to the item. No interruption, no gate.
5. **Measure.** Log play, finish and the next answer on that skill, so a film
   earns its place by the next answer, not by views.
