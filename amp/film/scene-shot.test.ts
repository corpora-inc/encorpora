/**
 * Any app figure in a film: a shot carries a scene spec with the author's own
 * data, driven by scene actions. The screenplay schema accepts it and rejects
 * malformed ones; the renderer's checks pass it in the 16:9 film and on a
 * phone, beside the board and the template's example figure; a scene action
 * naming a part the figure lacks is reported; film/parts.ts lists the names.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import type { Browser } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { secureChromium } from "../browser-security.mjs";
import { scriptSchema } from "./schema";
import { partsOf } from "./parts";
import { barScene, graphScene, sceneFilm, sceneScreenplay } from "./fixtures/scene-shot";

const AMP = fileURLToPath(new URL("..", import.meta.url));
const shot = (figure: unknown, actions: unknown[] = [{ do: "highlight", target: "c.bar.0" }]) => ({
  id: "t", title: "t",
  shots: [{ figure, beats: [{ say: "Oak.", do: [{ do: "scene", actions }] }] }],
});

describe("a shot's own scene in the screenplay", () => {
  it("accepts any app figure, including both examples in AUTHORING.md", () => {
    expect(scriptSchema.safeParse(sceneScreenplay).success).toBe(true);
    for (const scene of [barScene, graphScene]) expect(scriptSchema.safeParse(shot({ scene })).success).toBe(true);
    const doc = readFileSync(new URL("./AUTHORING.md", import.meta.url), "utf8");
    const section = doc.slice(doc.indexOf("### Any app figure"), doc.indexOf("### Build a figure"));
    const shots = [...section.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => JSON.parse(m[1]!));
    expect(shots.map((s) => Object.keys(s.figure))).toEqual([["scene"], ["scene"]]);
    for (const s of shots) {
      const r = scriptSchema.safeParse({ id: "doc", title: "doc", shots: [s] });
      expect(r.success ? "" : JSON.stringify(r.error.issues.slice(0, 2))).toBe("");
      expect(s.figure.scene).toEqual(s.figure.scene.elements[0].type === "barChart" ? barScene : graphScene);
      // every target the example names is a part of its figure
      const { parts } = partsOf(s.figure.scene);
      for (const b of s.beats) for (const a of b.do) for (const x of a.actions) expect(parts).toContain(x.target);
    }
  });
  it("rejects a malformed scene, a scene with its own steps, and a malformed scene action", () => {
    const bad = [
      shot({ scene: { v: 1, elements: [{ type: "barChart", id: "c", bars: "Oak" }] } }),
      shot({ scene: { v: 1, elements: [{ type: "pieChart", id: "c" }] } }),
      shot({ scene: { ...barScene, extra: true } }),
      shot({ scene: barScene, view: [0, 0, 1, 1] }),
      shot({ scene: { ...barScene, steps: [{ caption: "Oak", actions: [{ do: "highlight", target: "c.bar.0" }] }] } }),
      shot({ scene: barScene }, [{ do: "spin", target: "c.bar.0" }]),
      shot({ scene: barScene }, [{ do: "highlight" }]),
      shot({ scene: barScene }, [{ do: "move", target: "c.bar.0", by: [1] }]),
    ];
    for (const s of bad) expect(scriptSchema.safeParse(s).success, JSON.stringify(s.shots[0])).toBe(false);
  });
  it("still parses every shipped screenplay, whose scene actions are now typed", () => {
    const dir = new URL("./lessons/", import.meta.url);
    const names = readdirSync(dir).filter((n) => n.endsWith(".json"));
    expect(names.length).toBeGreaterThan(0);
    for (const n of names) {
      const r = scriptSchema.safeParse(JSON.parse(readFileSync(new URL(n, dir), "utf8")));
      expect(r.success ? "" : JSON.stringify(r.error.issues.slice(0, 2)), n).toBe("");
    }
  });
});

describe("film/parts.ts", () => {
  it("lists the parts a scene action can name, from a spec, {scene} or a whole shot", () => {
    const bar = partsOf(barScene);
    expect(bar.parts).toEqual(expect.arrayContaining(["c.bar.0", "c.bar.1", "c.bar.2", "c.bar.0.label", "c.unit"]));
    expect(partsOf({ scene: barScene })).toEqual(bar);
    const graph = partsOf({ figure: { scene: graphScene } });
    expect(graph.parts).toEqual(expect.arrayContaining(["g.line.0", "g.slope.0.rise", "g.slope.0.run", "g.point.0.label"]));
    // a crowded optional label is left out of the drawing, so it is not a name to target
    for (const d of graph.dropped) expect(graph.parts).not.toContain(d);
    expect(() => partsOf({ v: 1, elements: [{ type: "barChart", id: "c", bars: "Oak" }] })).toThrow(/Not a scene spec[\s\S]*elements/);
  });
  it("reads stdin from the command line", () => {
    const out = execFileSync(process.execPath, ["--import", "tsx", "film/parts.ts"], { cwd: AMP, input: JSON.stringify({ figure: { scene: barScene } }), encoding: "utf8" });
    expect(out.split("\n")).toEqual(expect.arrayContaining(["c.bar.0", "c.bar.2.label"]));
  }, 60_000);
});

// ---------------------------------------------------------------- the renderer, with every check on (what make.ts --dry runs)
const cases: Record<string, ReturnType<typeof sceneFilm>> = {};
let server: ViteDevServer;
let browser: Browser;
let origin = "";

/** The screenplay with one wrong target in a scene shot, and scene actions in a shot without an app figure. */
function wrongTargets() {
  const raw = structuredClone(sceneScreenplay) as any;
  raw.shots[0].beats[0].do[1].actions[0].target = "c.bar.9";
  raw.shots.push({ beats: [{ say: "That is all.", do: [{ do: "text", text: "That is all." }, { do: "scene", actions: [{ do: "highlight", target: "c.bar.0" }] }] }] });
  return raw;
}

beforeAll(async () => {
  cases.good = sceneFilm();
  cases.bills = sceneFilm({
    ...sceneScreenplay,
    shots: [{ figure: { scene: { v: 1, elements: [
      { type: "bill", id: "one", value: 1, at: [0, 0], width: 100 },
      { type: "bill", id: "five", value: 5, at: [112, 0], width: 100 },
    ] } }, beats: [{ say: "One dollar and five dollars.", do: [
      { do: "scene", actions: [{ do: "appear", target: "one" }] },
      { do: "scene", at: "five", actions: [{ do: "highlight", target: "five" }] },
      { do: "text", text: "One dollar and five dollars." },
    ] }] }],
  });
  cases.wrong = sceneFilm(wrongTargets());
  // the same server and page make.ts uses
  server = await createServer({
    root: AMP,
    logLevel: "error",
    server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
    plugins: [{
      name: "film-scene-shot",
      configureServer(vite) {
        vite.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/__film")) return next();
          const q = new URL(req.url, "http://x").searchParams;
          const film = cases[q.get("case") ?? ""];
          if (!film) { res.statusCode = 404; res.end(); return; }
          const payload = JSON.stringify({ script: film.script, timing: film.timing, figure: film.figure, still: 6, layout: q.get("layout") }).replace(/</g, "\\u003c");
          res.setHeader("Content-Type", "text/html");
          res.end(await vite.transformIndexHtml(req.url, `<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"></head><body><div id="film"></div><script>window.__filmData=${payload}</script><script type="module" src="/film/page.tsx"></script></body></html>`));
        });
      },
    }],
  });
  await server.listen();
  const addr = server.httpServer?.address();
  origin = `http://127.0.0.1:${addr && typeof addr === "object" ? addr.port : 0}`;
  browser = await secureChromium(chromium).launch();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
}, 30_000);

/** The renderer's checks for both layouts (it builds the other one off to the side), and the part names each shot drew. */
async function render(name: string, layout: "wide" | "tall") {
  const page = await browser.newPage({ viewport: layout === "tall" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${origin}/__film?case=${name}&layout=${layout}`);
    await page.waitForFunction(() => !!(window as any).__film, undefined, { timeout: 60_000 });
    await page.evaluate(() => (window as any).__film.ready);
    const issues = await page.evaluate(() => (window as any).__film.issues as string[]);
    const notes = await page.evaluate(() => (window as any).__film.notes as string[]);
    const drawn = await page.evaluate(() => [...document.querySelectorAll("#film .film-shot")].map((s) =>
      [...s.querySelectorAll(".film-real-figure [data-id]")].map((e) => e.getAttribute("data-id")!)));
    return { issues, notes, drawn, errors };
  } finally {
    await page.close();
  }
}

describe("scene shots in the renderer", () => {
  it("pass every check in the 16:9 film and on a phone, beside the board and an example shot", async () => {
    for (const layout of ["wide", "tall"] as const) {
      const got = await render("good", layout);
      expect(got.errors, layout).toEqual([]);
      expect(got.issues, layout).toEqual([]);
      // each shot draws its own figure; the example shot draws the template's
      expect(got.drawn[0], layout).toEqual(expect.arrayContaining(["c.bar.0", "c.unit"]));
      expect(got.drawn[1], layout).toEqual(expect.arrayContaining(["g.line.0", "g.slope.0.rise"]));
      expect(got.drawn[2], layout).toEqual(expect.arrayContaining(["line.label.0", "line.mark.1"]));
      expect(got.drawn[0]!.some((id) => id.startsWith("line.") || id.startsWith("g."))).toBe(false);
      // a crowded optional label the layout left out is a note, never a problem
      for (const n of got.notes) expect(n).toMatch(/leaves out crowded labels/);
    }
  }, 180_000);
  it("report a scene action that names no part, and one in a shot without an app figure", async () => {
    for (const layout of ["wide", "tall"] as const) {
      const got = await render("wrong", layout);
      expect(got.errors, layout).toEqual([]);
      expect(got.issues, layout).toContain('Shot 1: a scene action names "c.bar.9", but the figure has no part by that name. List its parts with film/parts.ts.');
      expect(got.issues.some((i) => /^Shot 4: scene actions drive an app figure, but this shot has none/.test(i)), layout).toBe(true);
      expect(got.issues.filter((i) => /c\.bar\.[012]"/.test(i)), layout).toEqual([]);
    }
  }, 180_000);
});

it("draws bill scenes in both film layouts with every renderer check enabled", async () => {
  for (const layout of ["wide", "tall"] as const) {
    const got = await render("bills", layout);
    expect(got.errors, layout).toEqual([]);
    expect(got.issues, layout).toEqual([]);
    expect(got.drawn[0], layout).toEqual(["one", "five"]);
  }
}, 180_000);
