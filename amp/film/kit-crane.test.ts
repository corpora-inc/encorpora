/**
 * Another product's films (kits.ts): the crane kit's figures and actions pass
 * the screenplay schema, every crane screenplay parses, and the crane figure's
 * timeline is a pure function of t (crane/film/timeline.ts).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scriptSchema } from "./schema";
import { kitOf } from "./kits";
import { CraneTimeline, covers, type CraneEntry } from "../../crane/film/timeline";

const film = (figure: unknown, act: Record<string, unknown>) => ({
  id: "t", title: "t",
  shots: [{ figure, beats: [{ say: "Lower the boom.", do: [{ do: "crane", ...act }] }] }],
});

describe("crane films in the screenplay schema", () => {
  it("accepts a crane figure and its actions", () => {
    const fig = { crane: { boom: { length: 74, radius: 20 } } };
    expect(scriptSchema.safeParse(film(fig, { set: { "boom.radius": 45 }, at: "Lower", dur: 3 })).success).toBe(true);
    expect(scriptSchema.safeParse(film(fig, { light: ["boom.block", "boom.radius"], until: "boom" })).success).toBe(true);
    expect(scriptSchema.safeParse(film(fig, { show: "boom.jib", hide: "boom.load" })).success).toBe(true);
  });
  it("rejects a crane action that does nothing, and unknown fields", () => {
    const fig = { crane: { boom: {} } };
    expect(scriptSchema.safeParse(film(fig, {})).success).toBe(false);
    expect(scriptSchema.safeParse(film(fig, { light: "boom", spin: 3 })).success).toBe(false);
  });
  it("parses every crane screenplay", () => {
    const dir = kitOf("crane").lessons;
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files).toContain("load-chart-reading.json");
    for (const f of files) {
      const parsed = scriptSchema.safeParse(JSON.parse(readFileSync(join(dir, f), "utf8")));
      expect(parsed.success, `${f}: ${parsed.success ? "" : parsed.error.message}`).toBe(true);
    }
  });
  it("knows the kits, and no others", () => {
    expect(kitOf().facts).toBe(true);
    expect(kitOf("crane").facts).toBe(false);
    expect(() => kitOf("dynawalla")).toThrow(/amp or crane/);
  });
});

describe("the crane figure's timeline", () => {
  const entry = (a: CraneEntry["a"], t0: number, dur = 1, beatEnd = t0 + 2, extra: Partial<CraneEntry> = {}): CraneEntry => ({ a, t0, dur, beatEnd, ...extra });
  const tl = new CraneTimeline({ "boom.radius": 20 }, ["boom.jib"], [
    entry({ do: "crane", set: { "boom.radius": 45 } }, 1, 2),
    entry({ do: "crane", show: "boom.jib" }, 4, 0.4),
    entry({ do: "crane", light: "chart.cell.30.74" }, 5, 0.3, 6),
  ]);
  it("eases a set value from its start to its end, and holds it", () => {
    expect(tl.value("boom.radius", 0.5)).toBe(20);
    const mid = tl.value("boom.radius", 2);
    expect(mid).toBeGreaterThan(20);
    expect(mid).toBeLessThan(45);
    expect(tl.value("boom.radius", 3)).toBe(45);
    expect(tl.value("boom.radius", 99)).toBe(45);
    expect(tl.target("boom.radius", 1.5)).toBe(45);
  });
  it("is the same at the same time however it is reached", () => {
    const a = tl.value("boom.radius", 2.3);
    tl.value("boom.radius", 0.1);
    expect(tl.value("boom.radius", 2.3)).toBe(a);
  });
  it("starts hidden parts hidden and fades them in", () => {
    expect(tl.opacity("boom.jib", 3.9)).toBe(0);
    expect(tl.opacity("boom.jib", 4.5)).toBe(1);
    expect(tl.opacity("boom.load", 0)).toBe(1);
  });
  it("lights a part on its word, holds it to the beat's end, and lets go", () => {
    expect(tl.light("chart.cell.30.74", 4.9)).toBe(0);
    expect(tl.light("chart.cell.30.74", 5.5)).toBe(1);
    expect(tl.light("chart.cell.30.74", 6.5)).toBe(0);
    expect(tl.light("chart.cell.30.7", 5.5)).toBe(0);
  });
  it("names cover the parts under them, never a longer sibling", () => {
    expect(covers("boom", "boom.block")).toBe(true);
    expect(covers("chart.row.3", "chart.row.30")).toBe(false);
  });
});
