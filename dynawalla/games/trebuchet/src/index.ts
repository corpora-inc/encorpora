/**
 * The mount point the runtime will call. Everything else in this package is
 * private to the game.
 */

import { createInstructions } from '../../../packs/shared/game-chrome/index.ts'
import type { Host, Mounted } from './contract.ts'
import { TrebuchetGame } from './game.ts'

export type { Host, Question, Mounted } from './contract.ts'

export function mount(el: HTMLElement, host: Host): Mounted {
  const game = new TrebuchetGame(el, host)
  // The harness reads frame stats and drives shots through the real input path.
  ;(el as HTMLElement & { __trebuchet?: TrebuchetGame }).__trebuchet = game

  // How to play. The HUD is deliberately wordless — a glyph costs no
  // translations and a child reading a label is a child not watching the arc —
  // so this panel is the ONLY place the rules are ever stated. It stays
  // reachable during play, because the moment a child needs the rules is never
  // the title.
  const guide = createInstructions(el, {
    title: 'TREBUCHET',
    summary: [
      'Your boulder has a sum written on it. Work out the answer.',
      'Set the range dial to that number and fire. The keep standing at that many metres comes down.',
    ],
    sections: [
      {
        heading: 'Taking a shot',
        lines: [
          'The boulder says something like 7 x 8. The answer is 56.',
          'Out on the field there is a keep standing at 56 metres.',
          'Use the plus and minus buttons to wind the dial to 56.',
          'You can also drag across the field to move the dial a long way at once.',
          'Then fire, and the boulder flies exactly that far and knocks it down.',
        ],
      },
      {
        heading: 'When you are wrong',
        lines: [
          'Say you dial 54 instead of 56. The boulder lands two metres short.',
          'It leaves a crater with 54 written in it, out where you can see it.',
          'So you do not just get told you were wrong. You get to see how far off you were.',
        ],
      },
      {
        heading: 'Take your time',
        lines: [
          'There is no clock. Nothing happens until you fire.',
          'Wind the dial as much as you like before you let the shot go.',
        ],
      },
    ],
    reducedMotion: host.prefersReducedMotion(),
    // Reading the rules is not thinking about the sum. The answer clock starts
    // again when the panel closes, so the time spent reading is not reported as
    // the child's answer latency.
    onClose: () => game.restartAnswerClock(),
  })

  // Nothing behind the panel is something the child did: the space bar would
  // otherwise fire the loaded boulder at whatever the dial happens to hold.
  game.setInputGuard(() => guide.isOpen)

  return {
    unmount(): void {
      guide.destroy()
      game.unmount()
      delete (el as HTMLElement & { __trebuchet?: TrebuchetGame }).__trebuchet
    },
  }
}

export { TrebuchetGame }
