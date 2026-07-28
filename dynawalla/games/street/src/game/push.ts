// THE PUSH — the only stake in the game, and it has no clock in it.
//
// The mob leans on you when you are wrong and gives ground when you put a rank
// down. Nothing here counts seconds, because a child who is *thinking* must
// never be losing: `EXPERIENCE_DESIGN.md` puts escalation on difficulty and
// repair and bans it on run length, and a creeping timer is that ban's exact
// target. Standing still and reading the mob costs nothing at all.
//
// At the top of the meter the mob shoves you back a block. That restarts the
// wave — it never touches the blocks you have already cleared. Construction
// does not regress (`P-04`); what you lose is ground, and ground is retakeable.

/** Marks between the mob and you. Six errors with no answer in between. */
export const PUSH_MAX = 6

export type Push = {
  /** 0 = the far end of the street. `PUSH_MAX` = they are on top of you. */
  readonly marks: number
}

export function newPush(): Push {
  return { marks: 0 }
}

/** A refused seam, a bounced fist, a caved rivet. They gain a mark. */
export function pressed(push: Push): Push {
  return { marks: Math.min(PUSH_MAX, push.marks + 1) }
}

/** A rank went down. They give one back. */
export function relieved(push: Push): Push {
  return { marks: Math.max(0, push.marks - 1) }
}

export function isShoved(push: Push): boolean {
  return push.marks >= PUSH_MAX
}

/** 0..1, for the renderer. The only float in the rules layer, and it draws. */
export function pressure(push: Push): number {
  return push.marks / PUSH_MAX
}
