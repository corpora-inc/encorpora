import { CanvasTexture, LinearFilter, SRGBColorSpace, Texture } from "three";
import { LABEL_COLS, LABEL_COUNT, LABEL_MIN, LABEL_ROWS } from "../core/labels.ts";

const FACE =
  '900 76px ui-rounded, "SF Pro Rounded", "Segoe UI Variable Display", ' +
  '"Nimbus Sans", Inter, system-ui, sans-serif';

/**
 * Bakes -40..40 into one square-tiled texture. White on transparent so the
 * shader can tint per instance; a soft dark rim is baked in so a numeral stays
 * readable when it lands on top of its own additive glow.
 */
export function buildLabelAtlas(tilePx: number): Texture {
  const c = document.createElement("canvas");
  c.width = LABEL_COLS * tilePx;
  c.height = LABEL_ROWS * tilePx;
  const g = c.getContext("2d");
  if (!g) throw new Error("[polarity] 2d context unavailable for the label atlas");

  g.textAlign = "center";
  g.textBaseline = "middle";

  for (let i = 0; i < LABEL_COUNT; i++) {
    const v = i + LABEL_MIN;
    const col = i % LABEL_COLS;
    const row = (i / LABEL_COLS) | 0;
    const cx = col * tilePx + tilePx / 2;
    const cy = row * tilePx + tilePx / 2;
    const s = v < 0 ? "−" + -v : String(v);

    g.save();
    g.translate(cx, cy);
    g.scale(tilePx / 128, tilePx / 128);
    g.font = FACE;
    // squeeze 3-glyph labels so "−40" occupies the same box as "7"
    const w = g.measureText(s).width;
    const maxW = 104;
    if (w > maxW) g.scale(maxW / w, 1);

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

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = false;
  tex.anisotropy = 1;
  tex.needsUpdate = true;
  return tex;
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
