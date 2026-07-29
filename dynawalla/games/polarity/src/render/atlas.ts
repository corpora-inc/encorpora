import { CanvasTexture, LinearFilter, SRGBColorSpace, Texture } from "three";
import {
  LABEL_ASPECT,
  LABEL_CELL_H,
  LABEL_COLS,
  LABEL_EM,
  LABEL_INK_W,
  LABEL_ROWS,
  LabelBook,
} from "../core/labels.ts";

const FACE =
  `900 ${String(LABEL_EM)}px ui-rounded, "SF Pro Rounded", "Segoe UI Variable Display", ` +
  '"Nimbus Sans", Inter, system-ui, sans-serif';

/**
 * The numerals on the playfield, painted on demand.
 *
 * White on transparent so the shader can tint per instance; a soft dark rim is
 * baked in so a numeral stays readable when it lands on top of its own additive
 * glow. Nothing is baked ahead of time — a cell is painted the first frame its
 * value is asked for, which is what lets an orb carry `3916` as easily as `7`.
 *
 * Cells are `LABEL_ASPECT` times wider than they are tall. A long answer gets
 * width, not a horizontal squeeze: every numeral on the field is drawn at the
 * same glyph HEIGHT, which is the thing a child reads at speed.
 *
 * `cellPx` is the HEIGHT. The width is `cellPx * LABEL_ASPECT`, and both tiers
 * are chosen so that product is a whole number of texels — the shader addresses
 * a tile as a fraction of `uGrid`, so a cell width the canvas has to round is a
 * cell whose neighbour bleeds into it.
 */
export class LabelAtlas {
  readonly book: LabelBook;
  readonly texture: Texture;
  readonly cols = LABEL_COLS;
  readonly rows = LABEL_ROWS;
  readonly aspect = LABEL_ASPECT;

  private readonly canvas: HTMLCanvasElement;
  private readonly g: CanvasRenderingContext2D;
  private readonly cellW: number;
  private readonly cellH: number;

  constructor(cellPx: number) {
    this.book = new LabelBook(LABEL_COLS * LABEL_ROWS);
    this.cellH = cellPx;
    this.cellW = cellPx * LABEL_ASPECT;
    // Loud, because the failure is silent and looks like a font bug: the shader
    // addresses a tile as `col / uGrid.x` of the texture, so if `cellPx *
    // LABEL_ASPECT` is not a whole number the canvas rounds its width and every
    // column after the first samples a sliver of its neighbour's numeral.
    if (!Number.isInteger(this.cellW)) {
      console.error(
        `[polarity] a ${String(cellPx)}px cell at aspect ${String(LABEL_ASPECT)} is ` +
          `${String(this.cellW)} texels wide, which is not a whole number — tiles will bleed`,
      );
    }
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.cols * this.cellW;
    this.canvas.height = this.rows * this.cellH;
    const g = this.canvas.getContext("2d");
    if (!g) throw new Error("[polarity] 2d context unavailable for the label atlas");
    this.g = g;
    g.textAlign = "center";
    g.textBaseline = "middle";

    const tex = new CanvasTexture(this.canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.anisotropy = 1;
    tex.needsUpdate = true;
    this.texture = tex;
  }

  /** Once per frame, before any `tileFor`. */
  beginFrame(): void {
    this.book.beginFrame();
  }

  /** The tile that prints `v`. Never negative — see `LabelBook.tileFor`. */
  tileFor(v: number): number {
    return this.book.tileFor(v);
  }

  /** Paint whatever changed this frame. A no-op on the frames nothing did. */
  flush(): void {
    const dirty = this.book.takeDirty();
    if (dirty.length === 0) return;
    for (const tile of dirty) this.paint(tile);
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }

  private paint(tile: number): void {
    const s = this.book.textAt(tile);
    if (s === null) return;
    const col = tile % this.cols;
    const row = (tile / this.cols) | 0;
    const x = col * this.cellW;
    const y = row * this.cellH;
    const g = this.g;

    g.clearRect(x, y, this.cellW, this.cellH);
    g.save();
    g.translate(x + this.cellW / 2, y + this.cellH / 2);
    g.scale(this.cellH / LABEL_CELL_H, this.cellH / LABEL_CELL_H);
    g.font = FACE;
    // Fitted, not clipped. Everything past `LABEL_INK_W` is squeezed to exactly
    // fill the box, which is what makes `labelAdvanceEm` true whatever face the
    // device resolved — the box is ours and the advance is not.
    const w = g.measureText(s).width;
    if (w > LABEL_INK_W) g.scale(LABEL_INK_W / w, 1);

    // dark contrast rim first, then the solid face
    g.lineJoin = "round";
    g.miterLimit = 2;
    g.strokeStyle = "rgba(0,0,0,0.92)";
    g.lineWidth = 13;
    g.strokeText(s, 0, 2);
    g.fillStyle = "#ffffff";
    g.fillText(s, 0, 2);
    g.restore();
  }
}

/**
 * A one-off texture for a question prompt ("−9 + 4"). Rebuilt once per seal,
 * never per frame. Wide aspect so it reads across a boss hull.
 */
export function buildPromptTexture(prompt: string, wpx = 1024, hpx = 256): Texture {
  const c = document.createElement("canvas");
  c.width = wpx;
  c.height = hpx;
  const g = c.getContext("2d");
  if (!g) throw new Error("[polarity] 2d context unavailable for a prompt");
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font =
    '800 132px ui-rounded, "SF Pro Rounded", "Segoe UI Variable Display", ' +
    '"Nimbus Sans", Inter, system-ui, sans-serif';
  let w = g.measureText(prompt).width;
  const maxW = wpx - 48;
  g.save();
  g.translate(wpx / 2, hpx / 2);
  if (w > maxW) g.scale(maxW / w, 1);
  g.lineJoin = "round";
  g.miterLimit = 2;
  g.strokeStyle = "rgba(0,0,0,0.94)";
  g.lineWidth = 20;
  g.strokeText(prompt, 0, 4);
  g.fillStyle = "#ffffff";
  g.fillText(prompt, 0, 4);
  g.restore();
  w = 0;

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}
