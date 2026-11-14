import { afterEach, expect, test, vi } from "vitest";
import { skills } from "../../../../curriculum/catalog";
import {
  bands,
  bandsHere,
  neighborhood,
  planRows,
  type MapSkill,
} from "../model";

const skill = (id: string, gradeBand: string, strand: string): MapSkill => ({
  id,
  title: id,
  description: "",
  gradeBand,
  strand,
  prerequisites: [],
});

test("the flat pathway holds every skill once, a row per band in order", () => {
  const rows = planRows(skills as unknown as MapSkill[]);
  const placed = rows.flatMap((row) => row.areas.flat().map((s) => s.id));
  expect(placed.length).toBe(skills.length);
  expect(new Set(placed).size).toBe(skills.length);
  expect(rows.map((row) => row.index)).toEqual(
    [...rows.map((row) => row.index)].sort((a, b) => a - b),
  );
  for (const row of rows)
    row.areas.forEach((list, area) =>
      list.forEach((s) => {
        expect(s.gradeBand).toBe(row.band);
        expect(neighborhood(s)).toBe(area);
      }),
    );
});

test("a band with no skills has no row; an unknown band sits with the first", () => {
  const rows = planRows([
    skill("a", "3", "number"),
    skill("b", "3", "geometry"),
    skill("c", "precalculus", "functions"),
    skill("d", "mystery", "data"),
  ]);
  expect(rows.map((row) => row.band)).toEqual(["K", "3", "precalculus"]);
  expect(rows[0]!.areas[4]!.map((s) => s.id)).toEqual(["d"]);
  expect(rows[1]!.areas[0]!.map((s) => s.id)).toEqual(["a"]);
  expect(rows[1]!.areas[3]!.map((s) => s.id)).toEqual(["b"]);
});

test("Where you are covers the bands in range, else the nearest band", () => {
  const rows = [0, 3, 4, 5, 12].map((index) => ({ index }));
  expect([...bandsHere({ lo: 2.6, hi: 5.2, level: 4 }, rows)]).toEqual([
    3, 4, 5,
  ]);
  // Between rows: the nearest one.
  expect([...bandsHere({ lo: 1.2, hi: 1.8, level: 1.5 }, rows)]).toEqual([0]);
  // Past the end of the curriculum: the last.
  expect([...bandsHere({ lo: 13, hi: 15, level: 14 }, rows)]).toEqual([
    bands.length - 1,
  ]);
  expect(bandsHere({ lo: 0, hi: 1, level: 0 }, []).size).toBe(0);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("a browser without WebGL 2 is told so before any canvas mounts", async () => {
  vi.stubGlobal("WebGL2RenderingContext", undefined);
  const { canDrawMap } = await import("../drawable");
  expect(canDrawMap()).toBe(false);
});

test("a WebGL 2 context draws the map, and the probe's context is let go", async () => {
  const loseContext = vi.fn();
  vi.stubGlobal("WebGL2RenderingContext", function () {});
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue({
      getExtension: () => ({ loseContext }),
    } as never);
  const { canDrawMap } = await import("../drawable");
  expect(canDrawMap()).toBe(true);
  expect(canDrawMap()).toBe(true);
  expect(getContext).toHaveBeenCalledTimes(1);
  expect(getContext).toHaveBeenCalledWith("webgl2");
  expect(loseContext).toHaveBeenCalledTimes(1);
  getContext.mockRestore();
});

test("a browser that refuses the context gets the flat pathway", async () => {
  vi.stubGlobal("WebGL2RenderingContext", function () {});
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(null);
  const { canDrawMap } = await import("../drawable");
  expect(canDrawMap()).toBe(false);
  getContext.mockRestore();
});
