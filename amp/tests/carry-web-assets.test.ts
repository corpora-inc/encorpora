import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error: a plain Node script (the Dockerfile runs it without tsx).
import { plan, KEEP_RELEASES } from "../scripts/carry-web-assets.mjs";

const at = (hoursAgo: number) =>
  new Date(
    Date.parse("2026-11-17T12:00:00Z") - hoursAgo * 3_600_000,
  ).toISOString();
const builtAt = at(0);

test("the first image after the ledger keeps the live image's files as one release", () => {
  const result = plan({
    own: ["index-new.js", "shared-same.js"],
    builtAt,
    seedLedger: null,
    seedFiles: ["index-old.js", "shared-same.js"],
  });
  assert.deepEqual(result.copy, ["index-old.js"]);
  assert.deepEqual(result.ledger.releases[0], {
    builtAt,
    files: ["index-new.js", "shared-same.js"],
  });
  assert.deepEqual(result.ledger.releases[1].files, [
    "index-old.js",
    "shared-same.js",
  ]);
});

test("no seed carries nothing", () => {
  const result = plan({
    own: ["a.js"],
    builtAt,
    seedLedger: null,
    seedFiles: [],
  });
  assert.deepEqual(result.copy, []);
  assert.equal(result.ledger.releases.length, 1);
});

test("releases past the window or the count are dropped, with their files", () => {
  const releases = Array.from({ length: KEEP_RELEASES + 2 }, (_, i) => ({
    builtAt: at(i + 1),
    files: [`r${i}.js`],
  }));
  releases.push({ builtAt: at(24 * 4), files: ["ancient.js"] });
  const result = plan({
    own: ["now.js"],
    builtAt,
    seedLedger: { releases },
    seedFiles: [...releases.flatMap((r) => r.files)],
  });
  assert.equal(result.ledger.releases.length, KEEP_RELEASES);
  assert.deepEqual(
    result.copy,
    Array.from({ length: KEEP_RELEASES - 1 }, (_, i) => `r${i}.js`).sort(),
  );
  assert.ok(!result.copy.includes("ancient.js"));
});

test("the release being replaced is kept however old it is", () => {
  // Four days without a deploy: the live release is past the window, and is
  // still the one every open page and old pod serves.
  const result = plan({
    own: ["now.js"],
    builtAt,
    seedLedger: {
      releases: [
        { builtAt: at(24 * 4), files: ["live.js"] },
        { builtAt: at(24 * 5), files: ["older.js"] },
      ],
    },
    seedFiles: ["live.js", "older.js"],
  });
  assert.deepEqual(result.copy, ["live.js"]);
  assert.deepEqual(
    result.ledger.releases.map((release: { files: string[] }) => release.files),
    [["now.js"], ["live.js"]],
  );
});

test("only files the seed really has, with plain names, are carried", () => {
  const result = plan({
    own: ["now.js"],
    builtAt,
    seedLedger: {
      releases: [
        { builtAt: at(1), files: ["here.js", "gone.js", "../etc/passwd", 7] },
        { builtAt: "not a time", files: ["undated.js"] },
        null,
      ],
    },
    seedFiles: ["here.js", "undated.js", "../etc/passwd"],
  });
  assert.deepEqual(result.copy, ["here.js"]);
  assert.deepEqual(result.ledger.releases[1], {
    builtAt: at(1),
    files: ["here.js"],
  });
  assert.equal(result.ledger.releases.length, 2);
});
