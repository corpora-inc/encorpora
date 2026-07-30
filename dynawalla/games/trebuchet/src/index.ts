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
      'The keeps are the stone towers out on the field, and each one stands at its own number of metres. Wind the dial to your answer and fire, and the keep standing at that many metres comes down.',
    ],
    sections: [
      {
        heading: 'Taking a shot',
        lines: [
          'The boulder says something like 7 x 8. The answer is 56.',
          'Out on the field there is a keep standing at 56 metres. A keep is a small stone tower, and its number is how far away it is.',
          'The dial is the number between the minus and plus buttons. It sets how far the boulder will fly.',
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
        // The mechanic that arrives after the child has already learnt the game, so
        // it is spelt all the way out, with the arithmetic done on the page. This
        // panel opens by itself the first time the wind blows.
        heading: 'Wind',
        lines: [
          'When the sums get harder, a wind starts blowing across the field.',
          'The wind readout sits under your row of boulders: an arrow, and a number.',
          'The arrow shows which way the wind will push your boulder, and the number is how many metres it will push it.',
          'So the wind moves the boulder AFTER it leaves. You have to aim into the wind, and let the wind carry the stone the rest of the way.',
          'Say the answer is 72, and the arrow points away from you with a 5 beside it.',
          'The wind will carry the boulder 5 metres further than the dial says, so dial 5 less. 72 take away 5 is 67.',
          'Dial 67, fire, and the wind pushes it the last 5 metres onto 72.',
          'If the arrow points back towards you, the wind holds the boulder 5 metres short instead, so dial 5 more. 72 and 5 is 77.',
          'Work out the sum first. Then take the wind off your answer, or add it on.',
          'The wind does not change while you are thinking. The number you can see is the number you get.',
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
  // And the game may raise the panel itself. It does that exactly once a run, the
  // first time the wind blows — the moment the rule about what a right answer looks
  // like changes. A mechanic that arrives silently and starts deciding whether a
  // child is right is the defect this game has already shipped once.
  game.setExplainer(() => {
    guide.open()
  })

  return {
    unmount(): void {
      guide.destroy()
      game.unmount()
      delete (el as HTMLElement & { __trebuchet?: TrebuchetGame }).__trebuchet
    },
  }
}

export { TrebuchetGame }
