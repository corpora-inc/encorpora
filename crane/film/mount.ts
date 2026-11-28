/**
 * Draws a shot's crane figure in the lesson-film stage (amp/film/stage.ts):
 * `figure: {"crane": {...}}` holds one or more pieces by kind, and the shot's
 * `crane` actions drive them. The stage centres the drawn ink in its card;
 * this mount only draws, at the piece's natural size, as a function of t.
 *
 *   { "crane": { "boom": {...}, "chart": {...}, "arrange": "row" } }
 */
import { BoomPiece } from "./pieces/boom";
import { ChartPiece } from "./pieces/chart";
import { BasePiece } from "./pieces/base";
import { ReevingPiece } from "./pieces/reeving";
import { SlingsPiece } from "./pieces/slings";
import { ClearancePiece } from "./pieces/clearance";
import type { Piece, PieceInit, Spec } from "./pieces/piece";
import { SVG_NS } from "./draw";
import { CraneTimeline, covers, type CraneAction, type CraneEntry } from "./timeline";

export const KINDS: Record<string, new (spec: Spec, init: PieceInit) => Piece> = {
  boom: BoomPiece,
  chart: ChartPiece,
  base: BasePiece,
  reeving: ReevingPiece,
  slings: SlingsPiece,
  clearance: ClearancePiece,
};
const LAYOUT = ["arrange", "gap"];

export type CraneMount = { seek: (t: number) => void; issues: string[]; notes: string[] };

/** The stage's entries for this shot, as it hands them to a figure mount. */
type StageEntry = { a: { do: string }; t0: number; dur: number; beatEnd: number; highlightEnd?: number; setup?: boolean };

export function mountCrane(spec: unknown, host: HTMLElement, entries: readonly StageEntry[]): CraneMount {
  const issues: string[] = [];
  const notes: string[] = [];
  const fig = (spec ?? {}) as Spec;
  const crane = entries.filter((e): e is CraneEntry & StageEntry => e.a.do === "crane") as CraneEntry[];
  const range = (key: string, start: number): [number, number] => {
    let lo = start, hi = start;
    for (const e of crane) {
      const v = (e.a as CraneAction).set?.[key];
      if (v !== undefined) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    }
    return [lo, hi];
  };

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "cf-figure");
  const kinds = Object.keys(fig).filter((k) => !LAYOUT.includes(k));
  if (!kinds.length) issues.push(`a crane figure names at least one piece: ${Object.keys(KINDS).join(", ")}.`);
  const pieces: { piece: Piece; g: SVGGElement }[] = [];
  for (const kind of kinds) {
    const Make = KINDS[kind];
    if (!Make) {
      issues.push(`a crane figure has no piece "${kind}". The pieces are: ${Object.keys(KINDS).join(", ")}.`);
      continue;
    }
    const g = document.createElementNS(SVG_NS, "g");
    svg.appendChild(g);
    const body = fig[kind];
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      issues.push(`crane.${kind} must be an object.`);
      continue;
    }
    pieces.push({ piece: new Make(body as Spec, { root: g, range, issues }), g });
  }

  // pieces side by side, or one over the other, centred on each other
  const arrange = fig.arrange === "row" ? "row" : "column";
  const gap = typeof fig.gap === "number" ? fig.gap : 56;
  const W = arrange === "row" ? pieces.reduce((s, p) => s + p.piece.w, 0) + gap * Math.max(0, pieces.length - 1) : Math.max(0, ...pieces.map((p) => p.piece.w));
  const H = arrange === "row" ? Math.max(0, ...pieces.map((p) => p.piece.h)) : pieces.reduce((s, p) => s + p.piece.h, 0) + gap * Math.max(0, pieces.length - 1);
  let at = 0;
  for (const { piece, g } of pieces) {
    const x = arrange === "row" ? at : (W - piece.w) / 2;
    const y = arrange === "row" ? (H - piece.h) / 2 : at;
    g.setAttribute("transform", `translate(${x},${y})`);
    at += (arrange === "row" ? piece.w : piece.h) + gap;
  }
  svg.setAttribute("width", String(W));
  svg.setAttribute("height", String(H));
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.overflow = "visible";
  const box = document.createElement("div");
  box.className = "cf-figure-box";
  box.style.cssText = "position:absolute;inset:0;display:flex;align-items:center;justify-content:center";
  box.appendChild(svg);
  host.appendChild(box);

  const initial = Object.assign({}, ...pieces.map((p) => p.piece.initial)) as Record<string, number>;
  const hidden = pieces.flatMap((p) => p.piece.hidden);
  const tl = new CraneTimeline(initial, hidden, crane);
  // every name an action or a spec uses must be a part (or hold parts) of these pieces
  const parts = pieces.flatMap((p) => p.piece.parts);
  for (const name of [...tl.named, ...hidden])
    if (!parts.some((p) => covers(name, p) || covers(p, name))) issues.push(`a crane action names "${name}", but the figure has no such part. Its parts: ${parts.join(", ")}.`);
  for (const key of tl.setKeys) if (!(key in initial)) issues.push(`a crane action sets "${key}", which this figure does not have. It has: ${Object.keys(initial).join(", ") || "no values"}.`);

  const seek = (t: number) => {
    for (const { piece } of pieces) piece.draw(tl, t);
  };
  seek(0);
  return { seek, issues, notes };
}
