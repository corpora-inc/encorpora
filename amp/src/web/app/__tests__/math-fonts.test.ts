/**
 * Math fonts are ready before a screen with formulas paints
 * (app/preload-math-fonts.ts): every face KaTeX's stylesheet declares is
 * loaded ahead of the first formula, so a formula, and a control sized by
 * it, never changes width after it has painted.
 */
import { afterEach, beforeEach, expect, test, vi } from "vitest";

type Face = { family: string; load: ReturnType<typeof vi.fn> };
let faces: Face[] = [];
const face = (family: string, load = vi.fn(async () => undefined)): Face => ({
  family,
  load,
});
async function fresh() {
  vi.resetModules();
  return import("../preload-math-fonts");
}
beforeEach(() => {
  faces = [];
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { [Symbol.iterator]: () => faces[Symbol.iterator]() },
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "fonts");
});

test("every math face is loaded once, and no other font", async () => {
  faces = [face('"KaTeX_Main"'), face("KaTeX_Size2"), face("Inter")];
  const fonts = await fresh();
  await fonts.mathFontsReady();
  await fonts.mathFontsReady();
  expect(faces[0]!.load).toHaveBeenCalledTimes(1);
  expect(faces[1]!.load).toHaveBeenCalledTimes(1);
  expect(faces[2]!.load).not.toHaveBeenCalled();
});

test("ready only when the slowest face is in", async () => {
  let arrive!: () => void;
  const slow = vi.fn(() => new Promise<void>((resolve) => (arrive = resolve)));
  faces = [face("KaTeX_Main"), face("KaTeX_AMS", slow as never)];
  const fonts = await fresh();
  let settled = false;
  const ready = fonts.mathFontsReady().then(() => (settled = true));
  await Promise.resolve();
  await Promise.resolve();
  expect(settled).toBe(false);
  arrive();
  await ready;
  expect(settled).toBe(true);
});

test("before the stylesheet is in, nothing is settled: the next caller looks again", async () => {
  const fonts = await fresh();
  await fonts.mathFontsReady();
  faces = [face("KaTeX_Main")];
  await fonts.mathFontsReady();
  expect(faces[0]!.load).toHaveBeenCalledTimes(1);
});

test("a face that fails is logged and holds nothing back", async () => {
  faces = [
    face("KaTeX_Main"),
    face(
      "KaTeX_Fraktur",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    ),
  ];
  const fonts = await fresh();
  await expect(fonts.mathFontsReady()).resolves.toBeUndefined();
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining("KaTeX_Fraktur"),
    expect.any(Error),
  );
});

test("a screen waits for its math fonts, but not past the wait", async () => {
  vi.useFakeTimers();
  faces = [
    face("KaTeX_Main", vi.fn(() => new Promise<void>(() => {})) as never),
  ];
  const fonts = await fresh();
  let painted = false;
  void fonts.mathFontsBeforePaint(500).then(() => (painted = true));
  await vi.advanceTimersByTimeAsync(499);
  expect(painted).toBe(false);
  await vi.advanceTimersByTimeAsync(2);
  expect(painted).toBe(true);
  expect(console.warn).toHaveBeenCalledWith(
    "Math fonts were not ready before the screen painted",
  );
});

test("fonts already in: the screen paints at once", async () => {
  vi.useFakeTimers();
  faces = [face("KaTeX_Main")];
  const fonts = await fresh();
  let painted = false;
  void fonts.mathFontsBeforePaint().then(() => (painted = true));
  await vi.advanceTimersByTimeAsync(0);
  expect(painted).toBe(true);
});
