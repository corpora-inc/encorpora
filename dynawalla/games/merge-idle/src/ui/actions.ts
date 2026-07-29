/**
 * What the action rail offers, as a pure function of where the reef has got to.
 *
 * Out here rather than inside `Game` for one reason: **a control appearing must
 * never reflow the playfield.** DISSOLVE used to be `visible: false` until the
 * shelf filled up, a `display:none` button takes no grid cell, and so the rail
 * grew from two rows to three the moment it appeared and shoved the whole reef
 * upward mid-play. Pure, the rule is a test — `band.test.ts` asks for every
 * combination of reef state and asserts the number of VISIBLE buttons never
 * moves — instead of something a reviewer has to notice.
 *
 * The idiom for a control a child has not earned yet is therefore `visible` and
 * `enabled: false`, which is what UPWELL already does when a child cannot
 * afford it, and which has the side benefit of showing that the thing exists.
 */

import { growCost, upwellCost, ventCost } from '../core/economy.ts'
import { fmtCompact } from '../core/ladder.ts'
import type { Action } from './hud.ts'

export type ActionInput = {
  essence: number
  upwells: number
  grows: number
  overcharges: number
  vents: number
  ventCap: number
  cols: number
  rows: number
  maxCols: number
  maxRows: number
  /** No empty cell left on the shelf. */
  full: boolean
  /** Nearly full, for long enough that the game has started nagging. */
  crowded: boolean
}

export function actionList(i: ActionInput): Action[] {
  const up = upwellCost(i.upwells)
  const aw = ventCost(i.vents + 1)
  const dp = growCost(i.grows + 1)
  const oc = 10 ** (3 + i.overcharges) * 2
  const canGrow = i.cols < i.maxCols || i.rows < i.maxRows
  return [
    {
      id: 'upwell',
      label: 'UPWELL',
      cost: up,
      hint: fmtCompact(up),
      enabled: i.essence >= up && !i.full,
      visible: true,
    },
    {
      id: 'awaken',
      label: 'AWAKEN',
      cost: aw,
      hint: i.vents >= i.ventCap ? 'max' : fmtCompact(aw),
      enabled: i.essence >= aw && i.vents < i.ventCap,
      visible: true,
    },
    {
      id: 'deepen',
      label: 'DEEPEN',
      cost: dp,
      hint: canGrow ? fmtCompact(dp) : 'max',
      enabled: i.essence >= dp && canGrow,
      visible: true,
    },
    {
      id: 'overcharge',
      label: 'OVERCHARGE',
      cost: oc,
      hint: fmtCompact(oc),
      enabled: i.essence >= oc,
      visible: true,
    },
    {
      id: 'purge',
      label: 'DISSOLVE',
      cost: 0,
      hint: 'free',
      // Always present, greyed until the shelf actually needs clearing. See
      // the note at the top of this file: this is the whole point of it.
      enabled: i.full || i.crowded,
      visible: true,
      urgent: i.crowded,
    },
  ]
}
