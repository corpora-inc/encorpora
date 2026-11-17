// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

/** Images that decode as told: each URL fails `failures[url]` times first. */
const failures: Record<string, number> = {};
const requested: string[] = [];
class FakeImage {
  src = "";
  decoding = "";
  fetchPriority = "";
  decode() {
    requested.push(this.src);
    if ((failures[this.src] ?? 0) > 0) {
      failures[this.src]!--;
      return Promise.reject(new DOMException("Load failed", "EncodingError"));
    }
    return Promise.resolve();
  }
}
beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  requested.length = 0;
  for (const key of Object.keys(failures)) delete failures[key];
  vi.stubGlobal("Image", FakeImage);
  vi.spyOn(console, "error").mockImplementation(() => {});
  // A failed picture asks whether a newer release is live; this one is.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<html></html>", { status: 200 })),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const load = async () => {
  const art = await import("../money-art");
  const { coinFaceUrl } = await import("../coin-art");
  const { billFaceUrl } = await import("../bill-art");
  return { ...art, coinFaceUrl, billFaceUrl };
};

test("the browser draws money from files, never from code", async () => {
  const { coinFaceUrl, billFaceUrl } = await load();
  for (const url of [
    ...Object.values(coinFaceUrl),
    ...Object.values(billFaceUrl),
  ]) {
    expect(url).not.toMatch(/^data:/);
    expect(url).toMatch(/\.(webp|svg)$/);
  }
  expect(coinFaceUrl.dime).toMatch(/dime\.webp$/);
  expect(billFaceUrl[5]).toMatch(/five\.svg$/);
});

test("a problem's money pictures are found wherever it draws them", async () => {
  const { moneyArtIn, coinFaceUrl, billFaceUrl } = await load();
  const problem = {
    prompt: "How much money is shown? Is a dime worth more than a nickel?",
    figure: {
      kind: "money-sets",
      sets: [{ items: ["quarter", "dime", "dime", "dollar"] }],
    },
    choices: [
      {
        scene: {
          v: 1,
          elements: [
            { type: "coins", id: "c", coins: [{ coin: "penny" }] },
            { type: "bill", id: "b", value: 5, at: [0, 0], width: 100 },
          ],
        },
      },
    ],
  };
  expect(new Set(moneyArtIn(problem))).toEqual(
    new Set([
      coinFaceUrl.quarter,
      coinFaceUrl.dime,
      coinFaceUrl.penny,
      billFaceUrl[5],
    ]),
  );
  expect(moneyArtIn({ figure: { kind: "analog-clocks" } })).toEqual([]);
});

test("a money problem is held until its pictures are decoded", async () => {
  const { withMoneyArt, artReady, coinFaceUrl } = await load();
  const problem = {
    figure: { kind: "money-sets", sets: [{ items: ["dime"] }] },
  };
  expect(artReady(coinFaceUrl.dime)).toBe(false);
  await expect(withMoneyArt(problem)).resolves.toBe(problem);
  expect(artReady(coinFaceUrl.dime)).toBe(true);
  // Decoded once, kept: the next one never asks again.
  await withMoneyArt(problem);
  expect(requested).toEqual([coinFaceUrl.dime]);
});

test("a picture that fails is asked again, logged, and then shown as an error", async () => {
  const { decodeArt, coinFaceUrl } = await load();
  failures[coinFaceUrl.penny] = 1;
  const recovered = decodeArt([coinFaceUrl.penny]);
  await vi.runAllTimersAsync();
  await expect(recovered).resolves.toBeUndefined();
  expect(console.error).toHaveBeenCalledOnce();

  failures[coinFaceUrl.quarter] = 5;
  const failed = decodeArt([coinFaceUrl.quarter]);
  failed.catch(() => {});
  await vi.runAllTimersAsync();
  await expect(failed).rejects.toMatchObject({
    kind: "network",
    message:
      "The pictures for this problem didn't load. Check your connection and try again.",
  });
  expect(requested.filter((url) => url === coinFaceUrl.quarter)).toHaveLength(
    3,
  );
  // Never remembered: the learner's Try again asks once more.
  delete failures[coinFaceUrl.quarter];
  const retried = decodeArt([coinFaceUrl.quarter]);
  await vi.runAllTimersAsync();
  await expect(retried).resolves.toBeUndefined();
});

test("a figure outside practice waits hidden in its own space until its coins can paint", async () => {
  const { TimeMoneyFigure } = await import("../../TimeMoneyFigure");
  const figure = {
    kind: "money-sets" as const,
    sets: [{ items: ["quarter" as const, "nickel" as const] }],
  };
  const { container } = render(<TimeMoneyFigure figure={figure} />);
  const svg = container.querySelector("svg")!;
  const box = svg.getAttribute("viewBox");
  expect(svg.style.visibility).toBe("hidden");
  await act(() => vi.runAllTimersAsync());
  expect(svg.style.visibility).toBe("");
  expect(svg.getAttribute("viewBox")).toBe(box);
});

test("practice fetches every money picture once, quietly", async () => {
  const { prefetchMoneyArt } = await load();
  const created: FakeImage[] = [];
  vi.stubGlobal(
    "Image",
    class extends FakeImage {
      constructor() {
        super();
        created.push(this);
      }
    },
  );
  prefetchMoneyArt();
  prefetchMoneyArt();
  expect(created).toHaveLength(6);
  expect(created.every((image) => image.fetchPriority === "low")).toBe(true);
});
