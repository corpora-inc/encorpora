/**
 * beatlounge — a compact playable keyboard strip to audition the analog patch.
 * Two octaves of piano keys; pointer-down triggers a one-shot preview at the
 * key's MIDI pitch. Touch / mouse; ≥44px hit targets via CSS; ARIA labels.
 *
 * This is an AUDITION surface (it doesn't write to the doc) — it calls back with
 * the MIDI pitch so the host triggers the bound track's instrument.
 */

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
const isBlack = (semitone: number) => [1, 3, 6, 8, 10].includes(semitone)

interface KeyDef {
  midi: number
  name: string
  black: boolean
  /** White-key index for layout (black keys position relative to it). */
  whiteIndex: number
}

/** Build `octaves` octaves starting at `startMidi` (C). */
const buildKeys = (startMidi: number, octaves: number): KeyDef[] => {
  const keys: KeyDef[] = []
  let whiteIndex = -1
  for (let i = 0; i < octaves * 12; i++) {
    const midi = startMidi + i
    const semitone = midi % 12
    const black = isBlack(semitone)
    if (!black) whiteIndex++
    keys.push({
      midi,
      name: `${NOTE_NAMES[semitone]}${Math.floor(midi / 12) - 1}`,
      black,
      whiteIndex,
    })
  }
  return keys
}

interface Props {
  /** MIDI pitch of the lowest C (default C3 = 48). */
  startMidi?: number
  octaves?: number
  onDown: (pitch: number) => void
}

export const Keyboard = ({ startMidi = 48, octaves = 2, onDown }: Props) => {
  const keys = buildKeys(startMidi, octaves)
  const whiteCount = keys.filter((k) => !k.black).length
  const whiteW = 100 / whiteCount

  return (
    <div className="bl-synth-keys" data-bl-nocapture role="group" aria-label="Audition keyboard">
      <div className="bl-synth-keys-bed">
        {keys
          .filter((k) => !k.black)
          .map((k) => (
            <button
              key={k.midi}
              type="button"
              className="bl-synth-key is-white"
              style={{ width: `${whiteW}%` }}
              aria-label={k.name}
              onPointerDown={(e) => {
                e.preventDefault()
                onDown(k.midi)
              }}
            />
          ))}
        {keys
          .filter((k) => k.black)
          .map((k) => (
            <button
              key={k.midi}
              type="button"
              className="bl-synth-key is-black"
              style={{ left: `${(k.whiteIndex + 1) * whiteW}%` }}
              aria-label={k.name}
              onPointerDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                onDown(k.midi)
              }}
            />
          ))}
      </div>
    </div>
  )
}

export { buildKeys }
