/**
 * beatlounge — instrument-browser action registry.
 *
 * One LLM-callable action: turn a track into a real General-MIDI soundfont voice
 * by GM program number. The command bus indexes this alongside every other
 * module's actions, so "make the bass track a fretless bass" becomes a tool call
 * that sets the track's instrument to { kind:"soundfont", program: 35, ... }.
 *
 * Pure: returns the commands; the store applies them as one undo step.
 */

import type { ModuleAction } from "../../contracts/module"
import type { Command } from "../../model/command"
import { GM_SOUNDFONT_ID } from "../../instruments/gmSoundbank"
import { gmProgramName } from "../../instruments/gmPrograms"

/** Clamp + wrap any number into a valid 0..127 GM program. */
const toProgram = (n: unknown): number => {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0
  return ((v % 128) + 128) % 128
}

/** Set a track to a GM soundfont voice by program (and optional bank). */
export const setGmProgramAction: ModuleAction = {
  name: "setGmInstrument",
  describe:
    "Make a track play a real General-MIDI instrument by program number (0-127). " +
    "Programs follow the GM standard, e.g. 0 Acoustic Grand Piano, 24 Nylon Guitar, " +
    "35 Fretless Bass, 48 String Ensemble, 56 Trumpet, 73 Flute.",
  impact: "mutate",
  params: {
    track: { type: "track", describe: "Which track to re-voice." },
    program: {
      type: "int",
      min: 0,
      max: 127,
      default: 0,
      describe: "GM program number (0-127).",
    },
    bank: {
      type: "int",
      min: 0,
      max: 128,
      default: 0,
      describe: "Bank select (0 = melodic; 128 = GM drum kits).",
    },
  },
  run(ctx, params) {
    const trackId =
      (typeof params.track === "string" && params.track) || ctx.targetTrackId
    if (!trackId) {
      return { commands: [], summary: "No track to re-voice." }
    }
    const program = toProgram(params.program)
    const bank =
      typeof params.bank === "number" && Number.isFinite(params.bank)
        ? Math.max(0, Math.min(128, Math.round(params.bank)))
        : 0
    const command: Command = {
      t: "setInstrument",
      trackId,
      config: { kind: "soundfont", soundfontId: GM_SOUNDFONT_ID, program, bank },
    }
    return {
      commands: [command],
      summary: `${gmProgramName(program, bank)}`,
    }
  },
}

export const instrumentsActions: ReadonlyArray<ModuleAction> = [setGmProgramAction]
