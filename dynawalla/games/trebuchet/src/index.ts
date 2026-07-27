/**
 * The mount point the runtime will call. Everything else in this package is
 * private to the game.
 */

import type { Host, Mounted } from './contract.ts'
import { TrebuchetGame } from './game.ts'

export type { Host, Question, Mounted } from './contract.ts'

export function mount(el: HTMLElement, host: Host): Mounted {
  const game = new TrebuchetGame(el, host)
  // The harness reads frame stats and drives shots through the real input path.
  ;(el as HTMLElement & { __trebuchet?: TrebuchetGame }).__trebuchet = game
  return {
    unmount(): void {
      game.unmount()
      delete (el as HTMLElement & { __trebuchet?: TrebuchetGame }).__trebuchet
    },
  }
}

export { TrebuchetGame }
