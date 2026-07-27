/**
 * Every entity lives in a preallocated typed array. Nothing in here allocates
 * after construction — a horde survivor that garbage-collects at minute twelve
 * is a horde survivor that stutters exactly when the screen is fullest.
 */

export class Pool {
  cap: number
  n = 0
  private free: Int32Array
  private freeN: number
  alive: Uint8Array

  constructor(cap: number) {
    this.cap = cap
    this.free = new Int32Array(cap)
    for (let i = 0; i < cap; i++) this.free[i] = cap - 1 - i
    this.freeN = cap
    this.alive = new Uint8Array(cap)
  }

  /** @returns index, or −1 when the pool is exhausted. */
  spawn(): number {
    if (this.freeN === 0) return -1
    const i = this.free[--this.freeN]
    this.alive[i] = 1
    this.n++
    return i
  }

  kill(i: number): void {
    if (this.alive[i] === 0) return
    this.alive[i] = 0
    this.free[this.freeN++] = i
    this.n--
  }

  reset(): void {
    this.alive.fill(0)
    for (let i = 0; i < this.cap; i++) this.free[i] = this.cap - 1 - i
    this.freeN = this.cap
    this.n = 0
  }
}

/**
 * A uniform grid over the live region. Rebuilt from scratch every tick with a
 * counting sort: two linear passes, no per-frame allocation, no hash map.
 */
export class Grid {
  cell = 44
  cols = 1
  rows = 1
  originX = 0
  originY = 0
  private counts: Int32Array
  private cursor: Int32Array
  items: Int32Array
  private maxCells: number

  constructor(maxItems: number, maxCells = 26000) {
    this.maxCells = maxCells
    this.counts = new Int32Array(maxCells + 1)
    this.cursor = new Int32Array(maxCells + 1)
    this.items = new Int32Array(maxItems)
  }

  configure(minX: number, minY: number, w: number, h: number, cell: number): void {
    this.cell = cell
    this.originX = minX
    this.originY = minY
    let cols = Math.max(1, Math.ceil(w / cell))
    let rows = Math.max(1, Math.ceil(h / cell))
    while (cols * rows > this.maxCells) {
      // Coarsen rather than overflow; correctness never depends on cell size.
      this.cell *= 1.35
      cols = Math.max(1, Math.ceil(w / this.cell))
      rows = Math.max(1, Math.ceil(h / this.cell))
    }
    this.cols = cols
    this.rows = rows
  }

  cellOf(x: number, y: number): number {
    let cx = Math.floor((x - this.originX) / this.cell)
    let cy = Math.floor((y - this.originY) / this.cell)
    if (cx < 0) cx = 0
    else if (cx >= this.cols) cx = this.cols - 1
    if (cy < 0) cy = 0
    else if (cy >= this.rows) cy = this.rows - 1
    return cy * this.cols + cx
  }

  build(count: number, alive: Uint8Array, xs: Float32Array, ys: Float32Array): void {
    const cells = this.cols * this.rows
    const counts = this.counts
    counts.fill(0, 0, cells + 1)
    for (let i = 0; i < count; i++) {
      if (alive[i] === 0) continue
      counts[this.cellOf(xs[i], ys[i]) + 1]++
    }
    for (let c = 0; c < cells; c++) counts[c + 1] += counts[c]
    this.cursor.set(counts.subarray(0, cells + 1))
    for (let i = 0; i < count; i++) {
      if (alive[i] === 0) continue
      const c = this.cellOf(xs[i], ys[i])
      this.items[this.cursor[c]++] = i
    }
  }

  start(cell: number): number {
    return this.counts[cell]
  }

  end(cell: number): number {
    return this.counts[cell + 1]
  }

  /** Clamped cell coordinates for an AABB query. */
  range(x: number, y: number, r: number, out: Int32Array): void {
    let x0 = Math.floor((x - r - this.originX) / this.cell)
    let x1 = Math.floor((x + r - this.originX) / this.cell)
    let y0 = Math.floor((y - r - this.originY) / this.cell)
    let y1 = Math.floor((y + r - this.originY) / this.cell)
    if (x0 < 0) x0 = 0
    if (y0 < 0) y0 = 0
    if (x1 >= this.cols) x1 = this.cols - 1
    if (y1 >= this.rows) y1 = this.rows - 1
    out[0] = x0
    out[1] = y0
    out[2] = x1
    out[3] = y1
  }
}

export class Enemies {
  pool: Pool
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  hp: Float32Array
  maxHp: Float32Array
  type: Uint8Array
  flash: Float32Array
  hitCd: Float32Array
  rot: Float32Array
  radius: Float32Array
  /** Behaviour scratch: charge wind-up, warden spawn timer, orbit phase. */
  st: Float32Array
  st2: Float32Array
  /** Damage the run has taken from this one, for the elite health bar. */
  born: Float32Array

  constructor(cap: number) {
    this.pool = new Pool(cap)
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.hp = new Float32Array(cap)
    this.maxHp = new Float32Array(cap)
    this.type = new Uint8Array(cap)
    this.flash = new Float32Array(cap)
    this.hitCd = new Float32Array(cap)
    this.rot = new Float32Array(cap)
    this.radius = new Float32Array(cap)
    this.st = new Float32Array(cap)
    this.st2 = new Float32Array(cap)
    this.born = new Float32Array(cap)
  }
}

export class Bullets {
  pool: Pool
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  life: Float32Array
  dmg: Float32Array
  pierce: Int16Array
  kind: Uint8Array
  crit: Uint8Array
  rot: Float32Array
  /** Homing target index, or −1. */
  tgt: Int32Array
  r: Float32Array
  g: Float32Array
  b: Float32Array
  size: Float32Array

  constructor(cap: number) {
    this.pool = new Pool(cap)
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.dmg = new Float32Array(cap)
    this.pierce = new Int16Array(cap)
    this.kind = new Uint8Array(cap)
    this.crit = new Uint8Array(cap)
    this.rot = new Float32Array(cap)
    this.tgt = new Int32Array(cap)
    this.r = new Float32Array(cap)
    this.g = new Float32Array(cap)
    this.b = new Float32Array(cap)
    this.size = new Float32Array(cap)
  }
}

export class Particles {
  pool: Pool
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  life: Float32Array
  max: Float32Array
  size: Float32Array
  r: Float32Array
  g: Float32Array
  b: Float32Array
  rot: Float32Array
  spin: Float32Array
  drag: Float32Array
  shape: Uint8Array
  glow: Float32Array

  constructor(cap: number) {
    this.pool = new Pool(cap)
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.max = new Float32Array(cap)
    this.size = new Float32Array(cap)
    this.r = new Float32Array(cap)
    this.g = new Float32Array(cap)
    this.b = new Float32Array(cap)
    this.rot = new Float32Array(cap)
    this.spin = new Float32Array(cap)
    this.drag = new Float32Array(cap)
    this.shape = new Uint8Array(cap)
    this.glow = new Float32Array(cap)
  }
}

export class Gems {
  pool: Pool
  x: Float32Array
  y: Float32Array
  vx: Float32Array
  vy: Float32Array
  value: Float32Array
  t: Float32Array
  pulled: Uint8Array

  constructor(cap: number) {
    this.pool = new Pool(cap)
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.value = new Float32Array(cap)
    this.t = new Float32Array(cap)
    this.pulled = new Uint8Array(cap)
  }
}

export class Numbers {
  pool: Pool
  x: Float32Array
  y: Float32Array
  vy: Float32Array
  vx: Float32Array
  life: Float32Array
  max: Float32Array
  value: Int32Array
  crit: Uint8Array
  r: Float32Array
  g: Float32Array
  b: Float32Array

  constructor(cap: number) {
    this.pool = new Pool(cap)
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.vy = new Float32Array(cap)
    this.vx = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.max = new Float32Array(cap)
    this.value = new Int32Array(cap)
    this.crit = new Uint8Array(cap)
    this.r = new Float32Array(cap)
    this.g = new Float32Array(cap)
    this.b = new Float32Array(cap)
  }
}

/** Expanding damage rings: PULSE, spore blooms, the nova, the Rift. */
export class Shocks {
  pool: Pool
  x: Float32Array
  y: Float32Array
  r: Float32Array
  rMax: Float32Array
  dmg: Float32Array
  life: Float32Array
  max: Float32Array
  kind: Uint8Array
  cr: Float32Array
  cg: Float32Array
  cb: Float32Array
  knock: Float32Array

  constructor(cap: number) {
    this.pool = new Pool(cap)
    this.x = new Float32Array(cap)
    this.y = new Float32Array(cap)
    this.r = new Float32Array(cap)
    this.rMax = new Float32Array(cap)
    this.dmg = new Float32Array(cap)
    this.life = new Float32Array(cap)
    this.max = new Float32Array(cap)
    this.kind = new Uint8Array(cap)
    this.cr = new Float32Array(cap)
    this.cg = new Float32Array(cap)
    this.cb = new Float32Array(cap)
    this.knock = new Float32Array(cap)
  }
}
