// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { layoutScene, type Scene } from "../src/math/scene";
import { numberLine } from "../src/math/scene/author";
import { cubicBezier, frameAt, type Step } from "../src/math/scene/timeline";
import { ScenePlayer } from "../src/web/scene/ScenePlayer";
import { SceneSvg } from "../src/web/scene/SceneSvg";
import { mountExample } from "./example";
import type { Action, Shot } from "./schema";

const scene: Scene = {
  v: 1,
  elements: [
    {
      type: "coins",
      id: "c",
      coins: [{ coin: "quarter" }, { coin: "quarter" }],
    },
    { type: "bill", id: "b", value: 1, at: [0, -100], width: 100 },
  ],
};
const steps: Step[] = [
  {
    caption: "First.",
    actions: [
      { do: "highlight", target: "c.coin.0" },
      { do: "highlight", target: "b" },
    ],
  },
  { caption: "Second.", actions: [{ do: "highlight", target: "c.coin.1" }] },
];
let host: HTMLDivElement;
let dispose: (() => void) | undefined;
let now: number;
let callbacks: Map<number, FrameRequestCallback>;

beforeEach(() => {
  host = document.createElement("div");
  document.body.appendChild(host);
  now = 0;
  callbacks = new Map();
  let serial = 0;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    callbacks.set(++serial, cb);
    return serial;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe() {
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
      }
      disconnect() {}
    },
  );
});
afterEach(() => {
  act(() => dispose?.());
  dispose = undefined;
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function tick(time: number) {
  now = time;
  const pending = [...callbacks.values()];
  callbacks.clear();
  act(() => pending.forEach((cb) => cb(time)));
}
function strength(id: string) {
  return Number(
    host
      .querySelector(
        `[data-id="${id}"] [data-coin-lit], [data-id="${id}"] [data-bill-lit]`,
      )
      ?.getAttribute("stroke-opacity") ?? 0,
  );
}
function mountPlayer(playerSteps: Step[]) {
  const root = createRoot(host);
  dispose = () => root.unmount();
  act(() =>
    root.render(
      createElement(ScenePlayer, {
        scene: { ...scene, steps: playerSteps },
        mode: "lesson",
      }),
    ),
  );
}
function click(text: string) {
  act(() =>
    [...host.querySelectorAll("button")]
      .find((b) => b.textContent === text)!
      .click(),
  );
}
const ease = cubicBezier("cubic-bezier(0.22, 0.7, 0.18, 1)");

it("label ink and outlines added by highlighting fade at partial strength", () => {
  const layout = layoutScene(
    numberLine({ id: "nl", min: 0, max: 2 }).mark(1).scene(),
  );
  const label = layout.items.find((d) => d.k === "text")!;
  if (label.k !== "text") throw new Error("Missing label");
  label.color = "warm";
  const shape = layout.items.find((d) => d.k === "circle")!;
  if (shape.k !== "circle") throw new Error("Missing circle");
  shape.stroke = undefined;
  const focus: Step[] = [
    { caption: "Focus.", actions: [{ do: "highlight", target: "nl" }] },
    { caption: "Rest.", actions: [] },
  ];
  const root = createRoot(host);
  dispose = () => root.unmount();
  for (const p of [0, 0.5, 1]) {
    act(() =>
      root.render(
        createElement(SceneSvg, {
          layout,
          label: "Line",
          states: frameAt(layout, focus, 1, p),
        }),
      ),
    );
    const text = host.querySelector(
      `[data-id="${label.id}"] text`,
    ) as SVGElement;
    const circle = host.querySelector(`[data-id="${shape.id}"]`)!;
    expect(text.style.fill).toBe(
      p === 0
        ? "var(--color-figure-ink)"
        : p === 1
          ? "var(--color-figure-warm)"
          : "color-mix(in srgb, var(--color-figure-warm) 50%, var(--color-figure-ink) 50%)",
    );
    expect(circle.getAttribute("stroke")).toBe(
      p === 0
        ? "var(--color-figure-accent)"
        : p === 1
          ? "none"
          : "color-mix(in srgb, transparent 50%, var(--color-figure-accent) 50%)",
    );
  }
});

it("film seeks fade coin growth and coin/bill rings over the next action's duration", () => {
  const shot: Shot = { figure: { scene }, beats: [{ say: "Two quarters." }] };
  const list = steps.map((step, i) => ({
    a: { do: "scene", actions: step.actions } as Action,
    t0: 1 + i * 2,
    dur: 0.9,
  }));
  let mounted: ReturnType<typeof mountExample>;
  act(() => {
    mounted = mountExample(null, host, shot, list, (fn) => {
      dispose = fn;
    });
  });
  const seek = (t: number) => act(() => mounted.seek!(t));
  seek(2);
  expect(strength("c.coin.0")).toBe(1);
  for (const p of [0, 0.5, 1]) {
    seek(3 + 0.9 * p);
    expect(strength("c.coin.0")).toBeCloseTo(1 - p);
    expect(strength("b")).toBeCloseTo(1 - p);
    expect(strength("c.coin.1")).toBeCloseTo(p);
    if (p === 0.5)
      expect(
        host.querySelector('[data-id="c.coin.0"] g')!.getAttribute("transform"),
      ).toContain("scale(1.125)");
  }
  seek(20);
  expect(strength("c.coin.1")).toBe(1);
  seek(3.45);
  expect(strength("c.coin.0")).toBeCloseTo(0.5);
  seek(0);
  expect(strength("c.coin.0")).toBe(0);
});

it("app autoplay fades over the same 900ms eased interval as the incoming highlight", () => {
  mountPlayer(steps);
  tick(900);
  expect(strength("c.coin.0")).toBe(1);
  tick(2300); // 1400ms hold, then the next step starts at progress zero.
  expect(strength("c.coin.0")).toBe(1);
  expect(strength("c.coin.1")).toBe(0);
  tick(2750);
  expect(strength("c.coin.0")).toBeCloseTo(1 - ease(0.5));
  expect(strength("c.coin.1")).toBeCloseTo(ease(0.5));
  tick(3200);
  expect(strength("c.coin.0")).toBe(0);
  expect(strength("c.coin.1")).toBe(1);
});

it("reduced motion keeps the final frame without scheduling animation", () => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"),
    addEventListener() {},
    removeEventListener() {},
  }));
  mountPlayer(steps);
  expect(strength("c.coin.0")).toBe(0);
  expect(strength("c.coin.1")).toBe(1);
  expect(callbacks.size).toBe(0);
  expect(host.querySelectorAll(".scene-player-all li")).toHaveLength(2);
});
