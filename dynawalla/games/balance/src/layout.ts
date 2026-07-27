// Responsive geometry. Nothing here is a fixed design size: a 360x640 phone in
// portrait and a 1440x900 desktop get genuinely different arrangements, not one
// scaled to fit the other. The rack reflows into rows; the arm shortens against
// height as well as width; touch targets have a floor.

export const MAX_PEG = 5;

export type Layout = {
  w: number;
  h: number;
  portrait: boolean;
  /** general scale hint for line weights and small type */
  u: number;
  pivot: { x: number; y: number };
  /** half-length of the beam, pixels */
  arm: number;
  /** vertical drop from the beam end to the dish */
  drop: number;
  dishW: number;
  dishH: number;
  weightR: number;
  crateR: number;
  plinth: { x: number; y: number; w: number; h: number };
  promptSize: number;
  rack: { y: number; rows: number; slotW: number; slotH: number; cols: number };
  hudPad: number;
};

const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export function computeLayout(w: number, h: number, rackCount: number): Layout {
  const portrait = h > w * 1.05;
  const u = clamp(Math.min(w / 900, h / 620), 0.55, 1.9);

  const weightR = clamp(Math.min(w / 15.5, h / 17), 17, 34);
  const slotW = weightR * 2 + weightR * 0.52;
  const slotH = weightR * 2.35;

  const margin = Math.max(10, w * 0.03);
  const cols = Math.max(3, Math.min(rackCount, Math.floor((w - margin * 2) / slotW)));
  const rows = Math.max(1, Math.ceil(rackCount / cols));

  const rackH = rows * slotH;
  const rackY = h - rackH - Math.max(12, h * 0.035);

  const arm = Math.min(w * 0.315, h * (portrait ? 0.30 : 0.40));
  const pivotY = clamp(h * (portrait ? 0.235 : 0.235), 90, h * 0.34);
  const drop = clamp((rackY - pivotY) * 0.42, weightR * 2.4, h * 0.26);

  const plinthW = Math.min(w * 0.62, arm * 1.7);
  const plinthH = clamp(h * 0.1, 44, 108);
  const plinthY = clamp(pivotY + drop + weightR * 2.9, h * 0.56, rackY - plinthH - 8 * u);

  return {
    w,
    h,
    portrait,
    u,
    pivot: { x: w / 2, y: pivotY },
    arm,
    drop,
    // never wider than the arm it hangs from, or a narrow screen clips it
    dishW: Math.min(weightR * 4.5, arm * 0.78),
    dishH: weightR * 0.95,
    weightR,
    crateR: weightR * 1.04,
    plinth: { x: w / 2 - plinthW / 2, y: plinthY, w: plinthW, h: plinthH },
    promptSize: clamp(Math.min(w / 13.5, h / 13), 17, 52),
    rack: { y: rackY, rows, slotW, slotH, cols },
    hudPad: Math.max(10, Math.min(w, h) * 0.028),
  };
}

/** Distance along the arm, in pixels, for a peg on a given mode. */
export function armDistance(L: Layout, mode: "pans" | "beam", peg: number): number {
  return mode === "pans" ? L.arm : (L.arm * peg) / MAX_PEG;
}

/** The point on the rotated beam where something hangs. */
export function beamPoint(
  L: Layout,
  theta: number,
  side: number,
  distance: number,
): { x: number; y: number } {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return {
    x: L.pivot.x + side * distance * c,
    y: L.pivot.y + side * distance * s,
  };
}

export function rackSlot(L: Layout, i: number, total: number): { x: number; y: number } {
  const { cols, rows, slotW, slotH, y } = L.rack;
  const row = Math.floor(i / cols);
  const inRow = i % cols;
  const countInRow = row === rows - 1 ? total - cols * row : cols;
  const rowW = countInRow * slotW;
  const x0 = L.w / 2 - rowW / 2 + slotW / 2;
  return { x: x0 + inRow * slotW, y: y + row * slotH + slotH * 0.5 };
}
