import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../browser-security.mjs";
import { lessons } from "../src/content/lessons";
import { publicationHtml } from "../src/content/publications";
const chromium = secureChromium(rawChromium);

test("long printed lesson examples retain complete printable question, step and answer groups", {
  skip: !existsSync(chromium.executablePath()) && "Chromium not installed",
}, () => {
  const directory = mkdtempSync(join(tmpdir(), "amp-lesson-pagination-"));
  try {
    const documents = ["nonlinear-data-model", "quadratic-parameter-root", "counting"].flatMap((id) => {
      const lesson = lessons.find((item) => item.id === id);
      assert.ok(lesson);
      const file = join(directory, `${id}.html`);
      writeFileSync(file, publicationHtml(lesson, "lesson"));
      return ["Letter", "A4"].map((format) => ({ file, format }));
    });
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/print-layout-oracle.ts"], {
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      input: JSON.stringify(documents), encoding: "utf8", timeout: 60_000,
    });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    assert.deepEqual(JSON.parse(result.stdout), { documents: 6, rejectedMutations: 27 });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
