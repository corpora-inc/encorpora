import type { PathOp, Element } from "./scene/spec";
import { scene } from "./scene/author";
import {
  emptyCounterBuilder,
  parseCounterBuilder,
  type CounterBuilderResponse,
} from "./counter-builder";

/** One shared 32-unit drawing per object, used on the board and in print.
 * Body silhouettes carry the group color; fine details stay unfilled. */
export const counterObjectPaths: Record<
  CounterBuilderResponse["thing"],
  PathOp[][]
> = {
  apple: [
    [
      ["M", 16, 9],
      ["C", 4, 2, 1, 18, 8, 27],
      ["Q", 12, 31, 16, 28],
      ["Q", 22, 32, 26, 25],
      ["C", 33, 11, 25, 3, 16, 9],
      ["Z"],
    ],
    [
      ["M", 16, 10],
      ["Q", 15, 3, 20, 1],
      ["M", 17, 6],
      ["Q", 26, 0, 27, 5],
      ["Q", 23, 10, 17, 6],
    ],
  ],
  duck: [
    [
      ["M", 4, 17],
      ["Q", 9, 21, 16, 18],
      ["L", 16, 10],
      ["C", 15, 0, 29, 1, 27, 10],
      ["L", 31, 12],
      ["L", 26, 15],
      ["C", 29, 29, 7, 32, 3, 20],
      ["Z"],
    ],
    [
      ["M", 23, 7],
      ["L", 23.5, 7],
      ["M", 11, 22],
      ["Q", 17, 26, 21, 20],
    ],
  ],
  frog: [
    [
      ["M", 6, 12],
      ["C", 0, 0, 16, 0, 15, 10],
      ["C", 17, 0, 31, 0, 27, 12],
      ["C", 35, 28, 0, 32, 4, 16],
      ["Z"],
    ],
    [
      ["M", 9, 8],
      ["L", 9.5, 8],
      ["M", 23, 8],
      ["L", 23.5, 8],
      ["M", 10, 20],
      ["Q", 16, 25, 22, 20],
    ],
  ],
  bird: [
    [
      ["M", 5, 18],
      ["L", 2, 11],
      ["L", 11, 15],
      ["Q", 12, 5, 22, 6],
      ["Q", 28, 6, 28, 12],
      ["L", 31, 14],
      ["L", 27, 16],
      ["C", 26, 28, 8, 30, 5, 18],
      ["Z"],
    ],
    [
      ["M", 23, 11],
      ["L", 23.5, 11],
      ["M", 12, 18],
      ["Q", 18, 23, 21, 16],
      ["M", 13, 26],
      ["L", 12, 30],
      ["M", 20, 26],
      ["L", 21, 30],
    ],
  ],
  dog: [
    [
      ["M", 8, 8],
      ["C", 0, -1, 0, 25, 7, 22],
      ["C", 8, 31, 25, 31, 26, 22],
      ["C", 33, 25, 32, -1, 24, 8],
      ["Q", 16, 3, 8, 8],
      ["Z"],
    ],
    [
      ["M", 11, 14],
      ["L", 11.5, 14],
      ["M", 22, 14],
      ["L", 22.5, 14],
      ["M", 14, 20],
      ["L", 18, 20],
      ["L", 16, 22],
      ["Z"],
      ["M", 16, 22],
      ["L", 16, 25],
    ],
  ],
  cup: [
    [["M", 5, 5], ["L", 24, 5], ["L", 23, 24], ["Q", 14, 31, 6, 24], ["Z"]],
    [
      ["M", 24, 9],
      ["C", 34, 5, 34, 24, 24, 20],
      ["M", 6, 10],
      ["L", 23, 10],
    ],
  ],
};
export const counterSvgPath = (ops: PathOp[]) =>
  ops.map((op) => op.join(" ")).join(" ");

/** A static, accessible model for figure-choice fallback, lessons and worksheets. */
export function counterBuilderScene(r: CounterBuilderResponse, raw?: string) {
  const a =
    raw === undefined
      ? emptyCounterBuilder(r)
      : (parseCounterBuilder(r, raw) ?? emptyCounterBuilder(r));
  const elements: Element[] = [];
  const regions = r.board === "two-groups" ? 2 : 1;
  for (let region = 0; region < regions; region++) {
    for (let i = 0; i < 10; i++) {
      const x = (i % 5) * 40 + region * 224,
        y = -Math.floor(i / 5) * 40;
      elements.push({
        type: "rect",
        at: [x, y - 36],
        size: [36, 36],
        fill: "none",
        stroke: "muted",
        width: 0.6,
      });
      const placed =
        r.board === "two-groups"
          ? i < a.groups[region]!
          : i < a.groups.reduce((s, n) => s + n, 0);
      if (!placed) continue;
      const rust =
        r.board === "two-groups"
          ? region === 1
          : r.board === "frame" && i >= a.groups[0]!;
      const crossed = r.canRemove && i >= a.groups[0]! - a.removed;
      counterObjectPaths[r.thing].forEach((ops, j) => {
        const d = ops.map(
          (op) =>
            [
              op[0],
              ...op
                .slice(1)
                .map((v, index) =>
                  index % 2 === 0 ? x + 2 + Number(v) : y - 2 - Number(v),
                ),
            ] as PathOp,
        );
        elements.push({
          type: "path",
          d,
          fill: j ? "none" : crossed ? "empty" : rust ? "warm" : "accent",
          stroke: crossed ? "muted" : "ink",
          width: 1.4,
        });
      });
      if (crossed)
        elements.push(
          {
            type: "segment",
            from: [x + 3, y - 3],
            to: [x + 33, y - 33],
            stroke: "ink",
            width: 2,
          },
          {
            type: "segment",
            from: [x + 3, y - 33],
            to: [x + 33, y - 3],
            stroke: "ink",
            width: 2,
          },
        );
    }
  }
  return scene(...elements).build({
    width: regions === 2 ? 440 : 260,
    maxHeight: 180,
    title:
      raw === undefined
        ? `Draw ${r.thing}s in the empty spaces`
        : r.canRemove
          ? `${a.groups[0]} ${r.thing}s at the start; ${a.removed} crossed out; ${a.groups[0]! - a.removed} left`
          : `${a.groups[0]} ${r.thing}s in one group and ${a.groups[1]} in the other`,
  });
}
