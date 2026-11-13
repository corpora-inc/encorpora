import { expect, it, vi } from "vitest";
import { join } from "node:path";
import { FILM_OUT } from "./paths";

const files = vi.hoisted(() => new Map<string, string>());
const screenplay = vi.hoisted(() => ({
  id: "letters", title: "Letters", shots: [{ beats: [{ say: "Make *a* longer and *b* shorter." }] }],
}));
vi.mock("node:fs", () => ({
  existsSync: (path: string) => files.has(path),
  readFileSync: (path: string) => {
    if (path.endsWith("/lessons/letters.json")) return JSON.stringify(screenplay);
    if (!files.has(path)) throw new Error(`Unexpected read: ${path}`);
    return files.get(path)!;
  },
  writeFileSync: (path: string, data: string) => files.set(path, data),
  mkdirSync: () => {},
}));
vi.mock("node:child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("../src/content/problem-lessons", () => ({ problemLesson: () => ({ example: {} }) }));
vi.mock("../src/math/engine", () => ({ templates: [] }));
vi.mock("../src/curriculum/catalog", () => ({ skills: [] }));

it("exports bare letters for the player, retaining timing and the marked screenplay", async () => {
  const words = "Make a longer and b shorter.".split(" ").map((text, start) => ({ text, start, end: start + 0.24 }));
  const timing = { duration: 7, shots: [[{ start: 0, end: 5.24, words }]] };
  files.set(join(FILM_OUT, "letters", "timing.json"), JSON.stringify(timing));
  const argv = process.argv;
  process.argv = [argv[0]!, "export-live.ts", "/export", "letters"];
  try {
    await import("./export-live");
    const data = JSON.parse(files.get("/export/letters.json")!);
    expect(data.script.shots[0].beats[0].say).toBe("Make a longer and b shorter.");
    expect(data.timing.shots).toEqual(timing.shots);
    expect(JSON.stringify(data)).not.toMatch(/\*|\bay\b/);
    expect(screenplay.shots[0]!.beats[0]!.say).toContain("*a*");
  } finally { process.argv = argv; }
});
