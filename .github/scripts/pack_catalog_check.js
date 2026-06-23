#!/usr/bin/env node
// Pack catalog integrity gate.
//
// Catches the production-embarrassment class of bugs before they ship:
//   1) Pack-id mismatch — the installer derives a pack's id from its ZIP
//      filename and normalizes hyphens to underscores for non-`phrase-` packs
//      (see corpan-app/src/contentPacks/install.ts). If the catalog/manifest id
//      doesn't equal that derived id, install fails with "Pack id mismatch".
//      (Lingo Hero shipped to preview broken exactly this way.)
//   2) Missing artwork — a catalog entry that declares an `avatarSource` whose
//      file doesn't exist ships with no image (catalog `imageUrl` becomes null).
//
// Validates EVERY entry in web/data/packs.json so a catalog-only edit is covered
// too, not just changes under corpan/packs/.

const fs = require("fs");
const path = require("path");

const CATALOG = "web/data/packs.json";
const raw = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
const packs = Array.isArray(raw) ? raw : raw.packs || [];
const errors = [];

for (const p of packs) {
  if (!p || !p.id) continue;

  // Local pack dir from manifestUrl: /corpan/packs/<dir>/manifest.json
  const mu = p.manifestUrl || "";
  const dm = mu.match(/\/corpan\/packs\/([^/]+)\/manifest\.json$/);
  const dir = dm ? path.join("corpan", "packs", dm[1]) : null;

  // (1) id convention — only for zip-installable packs (manifest-url-only
  // installs use manifest.id verbatim and are exempt). Legacy version-routed
  // aliases (entries pinned with `maxAppVersion`) intentionally encode a
  // version/legacy suffix in their frozen zip name and are exempt.
  if (p.zipUrl && !p.maxAppVersion) {
    const zipName = (p.zipUrl.match(/\/([^/]+)\.zip$/) || [])[1] || "";
    if (zipName) {
      const expected = zipName.startsWith("phrase-")
        ? zipName
        : zipName.replace(/-/g, "_");
      if (p.id !== expected) {
        errors.push(
          `${p.id}: catalog id must equal the installer-derived id "${expected}" ` +
            `(from zip "${zipName}.zip", hyphens→underscores) or install fails with "Pack id mismatch".`
        );
      }
      if (dir) {
        const mp = path.join(dir, "manifest.json");
        if (fs.existsSync(mp)) {
          const m = JSON.parse(fs.readFileSync(mp, "utf8"));
          if (m.id !== p.id) {
            errors.push(`${p.id}: manifest.json id "${m.id}" != catalog id "${p.id}" (${mp}).`);
          }
        }
      }
    }
  }

  // (2) artwork — a declared avatarSource must resolve to a real file.
  if (p.avatarSource && !fs.existsSync(p.avatarSource)) {
    errors.push(
      `${p.id}: avatarSource "${p.avatarSource}" does not exist — pack would ship with no artwork.`
    );
  }
}

if (errors.length) {
  console.error(`Pack catalog integrity FAILED (${errors.length} issue(s)):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log(`Pack catalog integrity OK (${packs.length} catalog entries checked).`);
