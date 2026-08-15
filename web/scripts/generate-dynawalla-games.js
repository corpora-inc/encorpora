#!/usr/bin/env node
/**
 * Generate `web/io/data/dynawalla-games.json` from the games' own manifests.
 *
 * The source of truth is `dynawalla/games/<game>/pack.json` — the same file
 * the app packages and ships. It is committed, so this runs in CI with no
 * dependency on the Dynawalla build having been run first (the built
 * `dynawalla/dist-packs/catalog.json` is gitignored and is NOT usable here).
 *
 * **Why this is generated rather than hand-maintained.** The App Store listing
 * spent weeks claiming twenty-seven games and naming one — "THE SPLIT" — that
 * had been renamed to MATH NINJA. A hand-written copy of the catalogue goes
 * stale silently and nothing fails. Regenerating on every build means a game
 * added, renamed or removed is correct on the site by doing nothing.
 */

const fs = require("fs");
const path = require("path");

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.join(SCRIPT_DIR, "..", "..");
const GAMES_DIR = path.join(REPO_ROOT, "dynawalla", "games");
const OUT_FILE = path.join(
  REPO_ROOT,
  "web",
  "io",
  "data",
  "dynawalla-games.json",
);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function main() {
  if (!fs.existsSync(GAMES_DIR)) {
    console.error(`[dynawalla] no games directory at ${GAMES_DIR}`);
    process.exit(1);
  }

  const games = [];
  for (const entry of fs.readdirSync(GAMES_DIR).sort()) {
    const manifestPath = path.join(GAMES_DIR, entry, "pack.json");
    // A directory without a manifest ships to nobody, so it is not a game the
    // site should advertise either. Skipped rather than failed: a work in
    // progress under games/ must not break the website build.
    if (!fs.existsSync(manifestPath)) continue;

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    games.push({
      id: manifest.id,
      slug: slugify(manifest.name),
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      minAge: manifest.minAge ?? null,
      skills: (manifest.covers && manifest.covers.skills) || [],
    });
  }

  games.sort((a, b) => a.name.localeCompare(b.name));

  const slugs = new Set();
  for (const game of games) {
    if (slugs.has(game.slug)) {
      // Two games whose names slugify identically would silently overwrite one
      // another's page, and the missing one would look like a routing bug.
      console.error(`[dynawalla] duplicate slug "${game.slug}" (${game.id})`);
      process.exit(1);
    }
    slugs.add(game.slug);
  }

  if (games.length === 0) {
    console.error("[dynawalla] no pack.json found under dynawalla/games/");
    process.exit(1);
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(games, null, 2) + "\n");
  console.log(`[dynawalla] Wrote ${OUT_FILE} — ${games.length} games`);
}

main();
