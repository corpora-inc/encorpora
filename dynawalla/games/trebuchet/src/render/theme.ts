/**
 * STORMFALL — the visual register.
 *
 * A siege fought at dusk under a breaking storm. Everything on the ground is a
 * near-black silhouette with a single warm rim of light along its top edge; the sky
 * behind it is a bruise going from indigo to ember. Two colours do all the work:
 * cold light from above, warm light from the fire you throw. Nothing is grey, and
 * nothing is decorated — shapes read at a glance from across a room, which is the
 * whole requirement for a game whose subject is *where things land*.
 */

export const C = {
  skyStops: [
    [0.0, '#03050d'],
    [0.28, '#0a0f2c'],
    [0.52, '#221844'],
    [0.72, '#57224a'],
    [0.85, '#a63d2b'],
    [0.93, '#e57f39'],
    [1.0, '#ffcb8a'],
  ] as Array<[number, string]>,

  ridgeFar: '#111634',
  ridgeMid: '#0a0e22',
  ridgeNear: '#050710',

  ground: '#04060e',
  groundLine: '#ff9a4a',
  groundDeep: '#02030a',
  scrub: '#080c1a',

  stone: '#070a16',
  stoneLit: '#171d33',
  stoneRim: '#ffab5e',
  stoneCold: '#5f86c9',

  banner: '#e4d7ba',
  bannerInk: '#0c1020',
  bannerWanted: '#ffd98a',

  fire0: '#fff4d6',
  fire1: '#ffb44e',
  fire2: '#ff5f18',
  smoke: '#2a2333',
  dust: '#4a3b46',

  bone: '#f2e9d5',
  boneDim: 'rgba(242,233,213,0.42)',
  steel: '#8fe3ff',
  steelDim: 'rgba(143,227,255,0.35)',
  windChip: '#ffd08a',
  rain: 'rgba(168,198,255,0.20)',
  danger: '#ff8a5c',
} as const

export const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'

export const font = (px: number, weight = 800, tracking = 0): string => {
  void tracking
  return `${weight} ${px}px ${FONT_STACK}`
}

export type Frame = {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  /** pixels per metre, including the camera punch */
  s: number
  /** seconds since mount, scaled */
  t: number
  dt: number
  reduced: boolean
}

/** Draw pixel-sized text at a world position without inheriting the flipped world scale. */
export function worldText(
  ctx: CanvasRenderingContext2D,
  s: number,
  x: number,
  y: number,
  fn: (c: CanvasRenderingContext2D) => void,
): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(1 / s, -1 / s)
  fn(ctx)
  ctx.restore()
}

/** A rounded rectangle path, in whatever space is current. */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}
