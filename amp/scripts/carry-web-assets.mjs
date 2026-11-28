#!/usr/bin/env node
// The web image keeps the hashed files of the releases before it
// (Dockerfile, stage `web-assets`). A tab opened before a deploy, or a page
// served by an old pod mid-rollout, then still finds every file its release
// names, instead of a 404 that costs the visitor a reload. Hashed names never
// change content, so carrying a file is always safe.
//
//   node scripts/carry-web-assets.mjs <assets> <seed-assets> <seed-ledger> <ledger-out>
//
// <assets> is this build's dist/assets (written into); <seed-assets> and
// <seed-ledger> come from the previous web image (empty without one). The
// ledger lists each kept release's own files, newest first; a release is kept
// for KEEP_RELEASES releases and at most KEEP_MS, so the image stays bounded.
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export const KEEP_RELEASES = 8;
export const KEEP_MS = 3 * 24 * 60 * 60 * 1000;

/** The releases to keep and the seed files to copy, from plain data. */
export function plan({ own, builtAt, seedLedger, seedFiles }) {
  const now = Date.parse(builtAt);
  const ownSet = new Set(own);
  // A previous image from before the ledger: its files are one release.
  const releases = Array.isArray(seedLedger?.releases)
    ? seedLedger.releases
    : seedFiles.length
      ? [{ builtAt, files: seedFiles }]
      : [];
  // The seed's own release (the first entry) is the one this image replaces:
  // it is kept whatever its age, or a deploy after a quiet spell would strand
  // every page it served. The window only ages out the releases before it.
  const previous = releases
    .filter(
      (release, index) =>
        release &&
        Array.isArray(release.files) &&
        (index === 0 ||
          (Number.isFinite(Date.parse(release.builtAt)) &&
            now - Date.parse(release.builtAt) < KEEP_MS)),
    )
    .slice(0, KEEP_RELEASES - 1);
  const available = new Set(seedFiles);
  const copy = new Set();
  const kept = [];
  for (const release of previous) {
    // A release missing any file can't be served whole: keep what exists of
    // it anyway, since every file found is one fewer reload.
    const files = release.files.filter(
      (file) =>
        typeof file === "string" &&
        /^[\w.-]+$/.test(file) &&
        (ownSet.has(file) || available.has(file)),
    );
    for (const file of files) if (!ownSet.has(file)) copy.add(file);
    kept.push({ builtAt: release.builtAt, files });
  }
  return {
    copy: [...copy].sort(),
    ledger: { releases: [{ builtAt, files: [...own].sort() }, ...kept] },
  };
}

function main([assets, seedAssets, seedLedgerPath, ledgerOut]) {
  if (!assets || !seedAssets || !seedLedgerPath || !ledgerOut)
    throw new Error(
      "usage: carry-web-assets.mjs <assets> <seed-assets> <seed-ledger> <ledger-out>",
    );
  const builtAt = process.env.BUILT_AT || new Date().toISOString();
  let seedLedger = null;
  if (existsSync(seedLedgerPath)) {
    try {
      seedLedger = JSON.parse(readFileSync(seedLedgerPath, "utf8"));
    } catch (error) {
      // A damaged ledger only costs the carry, never the build.
      console.warn(
        `carry-web-assets: the previous ledger is unreadable (${error}); carrying nothing`,
      );
    }
  }
  // Hashed files only: a subdirectory (pathway-cards/) is the build's own.
  const files = (dir) =>
    existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => entry.name)
      : [];
  const { copy, ledger } = plan({
    own: files(assets),
    builtAt,
    seedLedger,
    seedFiles: files(seedAssets),
  });
  for (const file of copy)
    copyFileSync(join(seedAssets, file), join(assets, file));
  writeFileSync(ledgerOut, JSON.stringify(ledger) + "\n");
  console.log(
    `carry-web-assets: ${ledger.releases.length} release(s) kept, ${copy.length} earlier file(s) carried`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`)
  main(process.argv.slice(2));
