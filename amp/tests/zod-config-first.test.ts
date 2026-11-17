import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/** Zod builds a schema's fast path by probing `new Function` unless
 * `jitless` is already set, and the content policy reports that probe
 * (production, 2026-11-17, on every page). The bundle runs a shared chunk's
 * modules in the order its entries import them, so each entry imports
 * lib/zod-config first, before anything that builds a schema. */
for (const entry of ["src/web/home-entry.tsx", "src/web/app/boot.tsx"])
  test(`${entry} imports zod's settings first`, () => {
    const first = readFileSync(entry, "utf8").match(
      /^import\s+(?:[^"']*\s+from\s+)?["']([^"']+)["'];?$/m,
    )?.[1];
    assert.match(first ?? "", /(?:^|\/)lib\/zod-config$/);
  });
