# Stargate Reader — Agent Knowledge Base

## What Is It

Audiobook reader Corpan pack for the "Fascinating Curiosities" book series (12 volumes). Babylon.js 3D visualization synced to word-level timestamps from forced alignment. Words flow toward the camera in a Star Wars crawl, passing through an oscilloscope at the "now" plane.

## Architecture

| File | Role |
|------|------|
| `src/game.ts` | Main orchestrator. Creates Babylon scene, DataProvider, AudioEngine, rendering systems, transport bar. |
| `src/data/dataProvider.ts` | Loads book data (segments, manifests, audio URLs). Two factories: fetch (dev) and preloaded (production). |
| `src/data/bookCatalog.ts` | Multi-book catalog for book switching. |
| `src/audio/audioEngine.ts` | Web Audio API sequential segment playback. Preloads ahead. Provides `getCurrentTimeMs()`. |
| `src/audio/waveformExtractor.ts` | Extracts per-word amplitude envelopes from decoded AudioBuffers. |
| `src/rendering/wordStream.ts` | Renders words as billboard planes flowing toward camera. |
| `src/rendering/oscilloscope.ts` | Thin cyan waveform line below the word stream. |
| `src/rendering/starfield.ts` | Background particle stars. |
| `src/ui/transportBar.ts` | DOM-based transport controls (play/pause, chapter skip, language, time). |
| `src/core/timeline.ts` | Builds flat word timeline from segments + manifest, binary search for current word. |
| `src/core/constants.ts` | All tuning parameters. |
| `src/core/types.ts` | TypeScript types: BookSegment, AudioManifest, TimelineWord, ChapterInfo. |

## Rendering Pipeline

### Word Stream (`wordStream.ts`)

- **Pool of plane meshes** — `MeshBuilder.CreatePlane()` with `BILLBOARDMODE_ALL` (always face camera)
- Each plane textured with `DynamicTexture` (512x256) rendering the word text
- **Single-file layout**: every word at x=0, positioned along z by timeline timestamp
- `y = crawlY(z)` — waterslide power curve: flat at top (dropper), accelerating middle (waterslide), linear at camera
- Curve: `y = CRAWL_HEIGHT * (1 - (1-t)^CRAWL_POWER)` where `t = z / LOOK_AHEAD_Z` (H=12, n=2.5)
- For z<=0 (past words): continues with tangent slope `y = (H*n/L) * z` for smooth falloff
- Words flow single-file down the center of the screen toward the camera
- **Fade**: `computeFade(z)` — fade in at distance, fully visible in middle, fade out behind camera

### Oscilloscope (`oscilloscope.ts`)

- **Single line mesh** — just `CreateLines()`, no ribbon, no frame
- Position: `y = OSCILLOSCOPE_Y` (0) — at the now-plane, words collide directly with it
- The oscilloscope IS the stargate — the energy portal words pass through
- Width: `OSCILLOSCOPE_WIDTH` (12 world units)
- Amplitude: `OSCILLOSCOPE_AMPLITUDE` (4.0) — swings wildly across the screen
- Color: white-cyan (0.8, 1.0, 1.0), pulses toward white-hot (0.9, 1.0, 1.0) with intensity
- Intensity: `rms * 5` (sensitive), floor 0.15 (always alive)
- Line mesh only — no GlowLayer interaction (lines don't bloom)

### Glow

- `GlowLayer` intensity: 0.3
- Oscilloscope ribbon glows; oscilloscope line excluded

## Data Flow

1. Book data lives in `books/fascinating-curiosities/{dirName}/pack/`
2. In dev mode, Vite middleware proxies `/data/books/{bookId}/*` to the books dir
3. In corpan dev mode, Node HTTP server on port 8990 serves book data
4. In production, Tauri host provides preloaded JSON via `initialState`

## Path Resolution

From `stargate-reader/` to `books/`: **THREE levels up** (`../../../books/fascinating-curiosities`).

## Key Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MS_PER_Z_UNIT` | 200 | Word spread in depth |
| `LOOK_AHEAD_Z` | 60 | Render distance ahead |
| `LOOK_BEHIND_Z` | 10 | Keep distance behind |
| `OSCILLOSCOPE_WIDTH` | 12 | Oscilloscope span |
| `CRAWL_HEIGHT` | 12 | Waterslide curve max y |
| `CRAWL_POWER` | 2.5 | Waterslide curve steepness |
| `OSCILLOSCOPE_AMPLITUDE` | 4.0 | Oscilloscope wave height |
| `OSCILLOSCOPE_Y` | 0 | Oscilloscope at now-plane |
| `GLOW_INTENSITY` | 0.3 | Bloom strength |

## Bugs Fixed (Feb 2026)

1. **Words invisible**: Ribbons in y-z plane had x=0 vertices; scaling.x * 0 = 0 width. Fixed by replacing with x-y planes.
2. **Oscilloscope fat bar**: Width 16, amplitude 1.5, alpha 0.95, plus glow bloom. Fixed by reducing all values and excluding from GlowLayer.
3. **Crawl inverted**: `y = -0.003 * z²` pushed words down. Fixed with linear `y = 0.12 * z`.
4. **Line drift**: Grouping by `i - visStart` shifted every frame. Fixed by using absolute word index.
5. **Single-file layout**: Removed 8-word line grouping — all words now flow single-file at x=0 with `y = CRAWL_SLOPE * z` (matching 3read reference: distant words high, descending toward camera).
6. **Oscilloscope invisible**: y=-2.5 was below visible area (±2.1 at z=0). Fixed by moving to y=-1.6, increasing amplitude/alpha/thickness, adding center line mesh, enabling glow on ribbon.
7. **Segment transition jerk**: `onended` handler added `duration_ms + pause_after_ms` to `accumulatedTimeMs` without resetting `segmentStartedAtCtxTime`, causing `getCurrentTimeMs()` to jump forward then snap back. Fixed by setting `accumulatedTimeMs = segmentAbsoluteStartMs[index] + entry.duration_ms`, resetting `segmentPlaybackOffset = 0`, and resetting `segmentStartedAtCtxTime = ctx.currentTime` in `onended`. Time now advances smoothly through inter-segment pauses.
8. **Crawl slope too shallow**: `CRAWL_SLOPE` 0.12 → 0.25 for more vertical spread (words descend more dramatically toward camera).
9. **Visual overhaul**: Replaced linear `CRAWL_SLOPE` with waterslide power curve (`crawlY()`). Added `BILLBOARDMODE_ALL` so words always face camera. Moved oscilloscope to `y=0` (now-plane) so words collide with it as they're highlighted. Boosted oscilloscope amplitude (2.0), brightness (white-hot pulse), and sensitivity (`rms*5`, floor 0.15).

## Deployment

**Reader code and narration audio are deployed independently.**

- **Reader code** (`dist/app.js`, `dist/app.css`) deploys to **GitHub Pages** via the
  `hover-runner-pages.yml` workflow. Push to `main` with changes under `corpan/packs/**`
  triggers build + deploy automatically. No narration re-publishing needed.

- **Narration audio** (ZIPs with segments, timestamps, M4A files) deploys to **S3/CloudFront**
  via `ttsctl publish`. See `infra/PUBLISHING.md`. Only re-publish narrations when audio
  or book data changes — NOT for reader code changes.

To ship a reader-only change (e.g. a UI tweak or gesture tuning):
1. Make the change in `src/`
2. `npm run build` — verify it builds
3. Bump `version` in `manifest.json`
4. Commit and push to `main`
5. GH Actions deploys automatically

## Dev Commands

```bash
# Standalone dev (Vite)
npm run dev

# Corpan dev (serves via Tauri)
npm run dev:corpan

# Typecheck
npx tsc --noEmit

# Build
npm run build
```
