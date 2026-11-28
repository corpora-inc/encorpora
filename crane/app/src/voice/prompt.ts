/**
 * Vocabulary priming for whisper (`initial_prompt`): the crane terms and
 * section numbers the model would otherwise mishear ("anti-tube block",
 * "energized" for "deenergized"). Identical to voice-eval/prompt.txt, the
 * prompt the model choice was measured with (voice.test.ts checks).
 */
export const VOCAB_PROMPT =
  "Crane operator questions about 29 CFR 1926 Subpart CC: power line clearance in kV, Table A, outriggers, cribbing, rated capacity, load chart, LMI (load moment indicator), anti-two-block, boom angle indicator, wire rope, broken wires per lay, birdcaging, kinking, core protrusion, rotation-resistant rope, signal person, qualified rigger, swing radius, jib, hook block, deenergized, dedicated spotter, sections 1408, 1412, 1413.";
