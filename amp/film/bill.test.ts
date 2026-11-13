// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountExample } from "./example";
import { partsOf } from "./parts";
import { scriptSchema, type Action } from "./schema";

const scene = {
  v: 1,
  elements: [
    { type: "bill", id: "one", value: 1, at: [0, 0], width: 100 },
    { type: "bill", id: "five", value: 5, at: [112, 0], width: 100 },
  ],
};
const screenplay = {
  id: "bill-test", title: "Dollar bills",
  shots: [{ figure: { scene }, beats: [{ say: "One dollar.", do: [
    { do: "scene", actions: [{ do: "appear", target: "one" }] },
    { do: "scene", actions: [{ do: "move", target: "one", by: [12, 30] }] },
    { do: "scene", actions: [{ do: "highlight", target: "five" }] },
  ] }] }],
};

describe("bills in a film's scene", () => {
  it("parses supported bills and lists the author's ids as action targets", () => {
    expect(scriptSchema.safeParse(screenplay).success).toBe(true);
    expect(partsOf({ scene }).parts).toEqual(["one", "five"]);
    const bad = structuredClone(screenplay);
    bad.shots[0]!.figure.scene.elements[0]!.value = 2;
    expect(scriptSchema.safeParse(bad).success).toBe(false);
  });

  it("shows, moves, highlights and seeks backwards through the shared renderer", () => {
    const shot = scriptSchema.parse(screenplay).shots[0]!;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const list = shot.beats[0]!.do!.map((a: Action, i: number) => ({ a, t0: 1 + i * 2, dur: 1 }));
    const disposers: (() => void)[] = [];
    try {
      const mounted = mountExample(null, host, shot, list, (dispose) => disposers.push(dispose));
      expect(mounted.issues).toEqual([]);
      expect(mounted.notes).toEqual([]);
      const first = () => host.querySelector('[data-id="one"]')!;
      const hrefs = () => [...host.querySelectorAll("image")].map((n) => n.getAttribute("href"));
      const originals = hrefs();
      expect(originals).toHaveLength(2);
      expect(originals.every((u) => u?.startsWith("data:image/svg+xml;base64,"))).toBe(true);
      mounted.seek!(0);
      expect(first().parentElement!.getAttribute("opacity")).toBe("0");
      mounted.seek!(2);
      expect(first().closest("g[opacity]")?.getAttribute("opacity") ?? "1").toBe("1");
      mounted.seek!(4);
      expect(first().parentElement!.getAttribute("transform")).toMatch(/^translate\(/);
      mounted.seek!(6);
      expect(host.querySelectorAll('[data-id="five"] [data-bill-lit]')).toHaveLength(1);
      expect(hrefs()).toEqual(originals);
      mounted.seek!(0);
      expect(first().parentElement!.getAttribute("opacity")).toBe("0");
      expect(first().parentElement!.getAttribute("transform")).toBeNull();
      expect(host.querySelectorAll("[data-bill-lit]")).toHaveLength(0);
    } finally {
      disposers.forEach((dispose) => dispose());
      host.remove();
    }
  });
});
