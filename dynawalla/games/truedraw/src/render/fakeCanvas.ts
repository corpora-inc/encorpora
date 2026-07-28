// A recording 2D context.
//
// The rendered-output gate in `EXPERIENCE_DESIGN.md` is a human looking at
// PNGs, and it should be. This is the part a machine can hold: that the scene
// draws without throwing at any size, in either motion branch, at every phase —
// and, the one that is a design claim rather than a robustness claim, that a
// wrong draw puts **no additional ink on the screen at all**.
//
// It records the ops rather than rasterising, so it needs no canvas backend and
// runs in the same plain `node --test` as everything else.

export type Op = {
  readonly name: string
  readonly args: readonly unknown[]
  /** `globalAlpha` at the moment of the call. Ink drawn at 0 is ink not drawn. */
  readonly alpha: number
  /** The `fillStyle` or `strokeStyle` in force — so a colour change is visible. */
  readonly style: string
}

export type Recorder = {
  readonly ops: Op[]
  /** Ops that put something on the screen, as opposed to setting up state. */
  ink(): Op[]
  reset(): void
}

const INK = new Set(["fill", "stroke", "fillRect", "strokeRect", "fillText"])

/**
 * A canvas-shaped object with a recording context. Returned as `unknown` so the
 * cast happens at the one call site rather than being spread through the file.
 */
export function fakeCanvas(width: number, height: number): { canvas: unknown; rec: Recorder } {
  const ops: Op[] = []
  let ctxRef: Record<string, unknown> | null = null
  const STROKES = new Set(["stroke", "strokeRect"])
  const record = (name: string) => (...args: unknown[]) => {
    const alpha = ctxRef?.["globalAlpha"]
    // Only the ops that actually consume a style carry one. `clearRect` and
    // friends would otherwise report whatever colour the previous frame left
    // behind, which is a fact about the recorder rather than about the frame.
    const style = INK.has(name) ? ctxRef?.[STROKES.has(name) ? "strokeStyle" : "fillStyle"] : ""
    ops.push({
      name,
      args,
      alpha: typeof alpha === "number" ? alpha : 1,
      // A gradient is an object; the constant colour cases are strings and are
      // the ones a "nothing changed" comparison needs to see.
      style: typeof style === "string" ? style : "<gradient>",
    })
  }

  const gradient = {
    addColorStop: record("addColorStop"),
  }

  const ctx: Record<string, unknown> = {
    canvas: null,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    globalAlpha: 1,
    font: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    setTransform: record("setTransform"),
    clearRect: record("clearRect"),
    save: record("save"),
    restore: record("restore"),
    translate: record("translate"),
    rotate: record("rotate"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    arc: record("arc"),
    rect: record("rect"),
    clip: record("clip"),
    fill: record("fill"),
    stroke: record("stroke"),
    fillRect: record("fillRect"),
    strokeRect: record("strokeRect"),
    fillText: record("fillText"),
    createLinearGradient: (...args: unknown[]) => {
      ops.push({ name: "createLinearGradient", args, alpha: 1, style: "" })
      return gradient
    },
    // A crude but monotone metric: enough for the layout code, which only ever
    // asks for relative widths.
    measureText: (text: string) => ({ width: [...text].length * 9 }),
  }

  const canvas = {
    width: 0,
    height: 0,
    style: {} as Record<string, string>,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width, height, top: 0, left: 0, right: width, bottom: height }),
  }
  ctx["canvas"] = canvas
  ctxRef = ctx

  return {
    canvas,
    rec: {
      ops,
      ink: () => ops.filter((op) => INK.has(op.name)),
      reset: () => {
        ops.length = 0
      },
    },
  }
}

/** Every numeric argument the scene passed to the context, flattened. */
export function numbersIn(ops: readonly Op[]): number[] {
  const out: number[] = []
  for (const op of ops) {
    for (const arg of op.args) if (typeof arg === "number") out.push(arg)
  }
  return out
}
