# Drum-Kit Corpus

The **4th corpus** in beatlounge, after rhythms, modes, and chords. A *kit* is a
set of per-voice **synthesis parameters baked in as plain data** — there are NO
sample assets and NO downloads. Every drum voice is synthesised by Tone, exactly
like the original hardcoded kit. A kit re-skins the **sound** of each drum voice;
it never changes the pitch/voice set (that stays the `DRUM_PITCH` + drum-pads
convention).

Source: `src/kits/`. Pure data + resolve helpers are decoupled from Tone and from
any UI, so the parametric synth, the `<KitPicker>`, and the tests all consume the
same surface.

## Voice roles (16)

A kit addresses the same fixed set of voices the drum instrument triggers by MIDI
pitch (`src/kits/voiceForPitch.ts`):

| pitch | role        | pitch | role     | pitch | role    | pitch | role    |
|------:|-------------|------:|----------|------:|---------|------:|---------|
| 36    | `kick`      | 42    | `closedHat` | 43 | `loTom` | 49   | `crash` |
| 38    | `snare`     | 44    | `pedalHat`  | 45 | `hiTom` | 51   | `ride`  |
| 37    | `rim`       | 46    | `openHat`   | 64 | `conga` | 56   | `cowbell` |
| 39    | `clap`      |       |             |    |         | 54   | `tamb`  |
|       |             |       |             |    |         | 70   | `shaker` |
|       |             |       |             |    |         | 75   | `click` (claves) |

An unknown pad routes to the `loTom` voice so it is never silent (matching the
original `default` branch).

## `KitDef` schema (`src/kits/types.ts`)

```ts
interface KitDef {
  id: string
  name: string
  family: "electronic" | "acoustic" | "world"
  description: string
  voices: Partial<Record<VoiceRole, VoiceParams>>  // partial → merged over default
}
```

A kit specifies ONLY the voices it gives a distinct character; `resolveKit` fills
the rest from the default ("studio") kit, so **every voice is always defined and
no pad is ever silent**.

### `VoiceParams`

Each voice is built from one of three engines via `source`:

- **`membrane`** — `Tone.MembraneSynth`: pitched body + fast pitch decay. Kicks,
  toms, congas, surdos. `baseNote` + `pitchDecay` + `octaves` shape the punch and
  the 808-style pitch drop.
- **`noise`** — `Tone.NoiseSynth` through an optional `filter2`→`filter` chain,
  plus an optional membrane `body` layer (the snare thump). Hats, snare top,
  claps, cymbals, shakers, tambourine.
- **`tonal`** — one or two `Tone.Oscillator`s through an optional band-pass, gated
  by an `AmplitudeEnvelope`. Cowbells (`partials` = two squares), claves, rims.

Shared shaping: `env` (AD[S]R), `filter`/`filter2` (lowpass/highpass/bandpass +
`q`), `level` (dB trim), `durationSec` (trigger length).

## The repertoire (18 kits)

**Electronic (10):** `studio` (default), `tr-808`, `tr-909`, `tr-707`, `techno`,
`house`, `trap`, `lofi`, `industrial`, `synthwave`.

**Acoustic (4):** `studio` (counted above; also the default), `rock`,
`jazz-brushes`, `orchestral`, `vintage-60s`.

**World (4):** `afro-cuban`, `batucada`, `middle-eastern`, `tabla`.

> The default `studio` kit is a parameter-for-parameter transcription of the
> original hardcoded kit and is the byte-for-ear baseline every other kit merges
> over.

## API (`src/kits/index.ts`)

```ts
getKit(id)              // KitDef | undefined
listKits()              // readonly KitDef[] (corpus order)
kitsByFamily(family)    // KitDef[]
kitsGroupedByFamily()   // [{ family, kits }] in picker order
resolveKit(kit)         // ResolvedKit — every voice filled from the default
resolveKitId(id)        // ResolvedKit — by id, default fallback (warns on unknown)
roleForPitch(pitch)     // VoiceRole | undefined
ROLE_TO_PITCH / PITCH_TO_ROLE
```

## Parametric synth & live swap

`src/instruments/drumKit.ts` builds its 16 voices from a `ResolvedKit`
(`src/kits/buildVoice.ts` is the single Tone touchpoint). `createDrumKitInstrument`
reads `config.kitId` → `resolveKitId` → builds that kit.

A kit swap is **live**: the audioGraph reconciler calls `instrument.update(config)`
on any instrument-config change; `update()` re-reads `kitId`, and if it changed it
disposes the old voices and rebuilds from the new `KitDef`. The output `Gain` is
stable across the swap, so track wiring (inserts/sends) is untouched and there are
no node leaks.

Selecting a kit is a single `setInstrument` command that swaps `kitId` while
preserving the rest of the drum config — no model or command change is needed.

## `<KitPicker>` (`src/kits/KitPicker.tsx`)

A self-contained, reusable component the integrator embeds into the drum page:

```tsx
import { KitPicker } from "../../kits/KitPicker"
<KitPicker host={host} store={store} trackId={drumTrackId} />
```

Browses kits grouped by family, highlights the active kit, selects a kit
(→ `setInstrument`), and auditions a couple of signature voices on an explicit
preview tap **without starting the transport** ("setup, don't play"). Premium
dark — `--bl-*` tokens only, inline-SVG glyphs (no emoji), ≥44px hits, responsive
grid, `prefers-reduced-motion` honoured.
