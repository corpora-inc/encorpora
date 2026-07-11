#!/usr/bin/env node
/**
 * Build script for generating GitHub Pages site structure
 *
 * This script generates landing pages at each level:
 * - Root: /index.html
 * - Corpan: /corpan/index.html
 * - Packs: /corpan/packs/index.html
 *
 * Usage: node build.js <output-dir>
 */

const fs = require('fs');
const path = require('path');

// Paths
const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..');
const TEMPLATES_DIR = path.join(SCRIPT_DIR, 'templates');
const DATA_DIR = path.join(SCRIPT_DIR, '..', 'data');
const CORPAN_LOGO_SOURCE = path.join(
  REPO_ROOT,
  'corpan',
  'corpan-app',
  'src-tauri',
  'icons',
  '512x512.png'
);

const basePathWithSlash = '/';

function readTemplate(name) {
  const templatePath = path.join(TEMPLATES_DIR, `${name}.html`);
  return fs.readFileSync(templatePath, 'utf-8');
}

function readData(name) {
  const dataPath = path.join(DATA_DIR, `${name}.json`);
  return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

function readDataOptional(name) {
  const dataPath = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(dataPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  } catch (err) {
    console.warn(`[pages] Failed to parse ${name}.json:`, err);
    return null;
  }
}

function resolveManifestPath(pack) {
  if (pack.manifestUrl && typeof pack.manifestUrl === 'string') {
    const trimmed = pack.manifestUrl.replace(/^\//, '');
    if (trimmed.startsWith('corpan/packs/')) {
      return path.join(REPO_ROOT, trimmed);
    }
  }
  const slug = String(pack.id || '').replace(/_/g, '-');
  if (!slug) return null;
  return path.join(REPO_ROOT, 'corpan', 'packs', slug, 'manifest.json');
}

// Cache parsed manifests so we don't re-read the same file three times
// per pack (once for version, once for localized fields, etc.).
const _manifestCache = new Map();

function readManifest(pack) {
  const manifestPath = resolveManifestPath(pack);
  if (!manifestPath) return null;
  if (_manifestCache.has(manifestPath)) {
    return _manifestCache.get(manifestPath);
  }
  if (!fs.existsSync(manifestPath)) {
    _manifestCache.set(manifestPath, null);
    return null;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    _manifestCache.set(manifestPath, parsed);
    return parsed;
  } catch (error) {
    console.warn(`[pages] Failed to read manifest for ${pack.id}:`, error);
    _manifestCache.set(manifestPath, null);
    return null;
  }
}

function readManifestVersion(pack) {
  const manifest = readManifest(pack);
  if (!manifest) {
    console.warn(`[pages] Missing manifest for ${pack.id}, using 0.0.0`);
    return "0.0.0";
  }
  if (typeof manifest.version === 'string' && manifest.version.trim()) {
    return manifest.version.trim();
  }
  return "0.0.0";
}

function compareVersions(a, b) {
  const normalize = (value) =>
    String(value)
      .split('.')
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  const left = normalize(a);
  const right = normalize(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function assertCatalogHostCompatibility(pack) {
  const manifest = readManifest(pack);
  if (pack.requireVersionedArtifact === true) {
    const versionSegment = `/${manifest?.version}/`;
    if (typeof pack.zipUrl !== 'string' || !pack.zipUrl.includes(versionSegment)) {
      throw new Error(
        `[pages] ${pack.id} requires an immutable artifact URL containing ${versionSegment}`
      );
    }
  }

  const manifestMin = manifest?.minAppVersion;
  if (typeof manifestMin !== 'string' || !manifestMin.trim()) return;

  const catalogMin =
    typeof pack.minAppVersion === 'string' && pack.minAppVersion.trim()
      ? pack.minAppVersion.trim()
      : '0.9.0';
  if (compareVersions(catalogMin, manifestMin) < 0) {
    throw new Error(
      `[pages] ${pack.id} catalog minAppVersion ${catalogMin} is below manifest minAppVersion ${manifestMin}`
    );
  }

  // catalog.json has no host-version field. A pack with an explicit modern
  // host requirement must opt out or old/fallback clients can install it.
  if (compareVersions(manifestMin, '0.9.0') > 0 && pack.v1Listed !== false) {
    throw new Error(
      `[pages] ${pack.id} requires app ${manifestMin} but is included in unversioned catalog.json; set v1Listed to false`
    );
  }

}

function assertVersionedCompatibilityRoutes(packs) {
  const byId = new Map();
  for (const pack of packs) {
    if (pack.requireVersionedArtifact !== true) continue;
    const group = byId.get(pack.id) || [];
    group.push(pack);
    byId.set(pack.id, group);
  }

  for (const [id, entries] of byId) {
    entries.sort((a, b) =>
      compareVersions(a.minAppVersion || '0.9.0', b.minAppVersion || '0.9.0')
    );
    for (let i = 1; i < entries.length; i += 1) {
      const previous = entries[i - 1];
      const current = entries[i];
      if (
        !previous.maxAppVersion ||
        compareVersions(previous.maxAppVersion, current.minAppVersion || '0.9.0') >= 0
      ) {
        throw new Error(
          `[pages] ${id} immutable compatibility routes overlap: ` +
          `${previous.minAppVersion || '0.9.0'}..${previous.maxAppVersion || 'latest'} and ` +
          `${current.minAppVersion || '0.9.0'}..${current.maxAppVersion || 'latest'}`
        );
      }
    }
  }
}

// Pull `nameLocalized` / `descriptionLocalized` maps off the pack's
// manifest. Returns `{}` when the manifest is missing or the maps are
// absent — the packs.json `name` / `description` then serve as English
// fallback through `resolveLocalized` at render time.
//
// We deliberately override `.en` to match the packs.json `name` /
// `description`. The bare `name` / `description` on the catalog entry
// always comes from packs.json (the marketing surface), and the
// localized-map's `en` entry must agree with it so the
// resolveLocalized() chain produces a single canonical English string.
function readManifestLocalized(pack) {
  const manifest = readManifest(pack);
  const out = {};
  if (
    manifest &&
    manifest.nameLocalized &&
    typeof manifest.nameLocalized === 'object' &&
    !Array.isArray(manifest.nameLocalized)
  ) {
    const nl = { ...manifest.nameLocalized };
    if (typeof pack.name === 'string' && pack.name.length > 0) {
      nl.en = pack.name;
    }
    out.nameLocalized = nl;
  }
  if (
    manifest &&
    manifest.descriptionLocalized &&
    typeof manifest.descriptionLocalized === 'object' &&
    !Array.isArray(manifest.descriptionLocalized)
  ) {
    const dl = { ...manifest.descriptionLocalized };
    if (typeof pack.description === 'string' && pack.description.length > 0) {
      dl.en = pack.description;
    }
    out.descriptionLocalized = dl;
  }
  return out;
}

// Pull the pack's `activities` (Journey activity declarations) off its
// manifest.json and forward them VERBATIM into the catalog entry
// (activity-contract.md §4.3). This is how the Journey scheduler discovers
// which installed packs can serve as interludes and what item kinds each
// consumes (e.g. wordfall:catch, drift:read, lingo_hero:round). Returns `{}`
// when the manifest is missing or declares no activities.
function readManifestActivities(pack) {
  const manifest = readManifest(pack);
  if (
    manifest &&
    Array.isArray(manifest.activities) &&
    manifest.activities.length > 0
  ) {
    return { activities: manifest.activities };
  }
  return {};
}

// Single source of truth for experience names + blurbs: the existing
// `experiences.<id>.{name, blurb}` keys in
// `corpan/corpan-app/public/locales/<lang>/common.json`. Translators have
// already populated these across 50+ locales for the 8 pre-existing packs;
// we denormalize them into the catalog so the running app can render
// localized text from the catalog field (`nameLocalized` / `taglineLocalized`)
// without depending on bundled i18n keys. Falls back gracefully when a
// locale doesn't have the key for a given pack (e.g. a newly added pack).
const _localesCache = {};
function loadAllLocales() {
  if (_localesCache.loaded) return _localesCache.byLang;
  const localesDir = path.join(REPO_ROOT, 'corpan', 'corpan-app', 'public', 'locales');
  const byLang = {};
  if (fs.existsSync(localesDir)) {
    for (const lang of fs.readdirSync(localesDir)) {
      if (lang.startsWith('_') || lang.startsWith('.')) continue;
      const commonPath = path.join(localesDir, lang, 'common.json');
      if (!fs.existsSync(commonPath)) continue;
      try {
        const parsed = JSON.parse(fs.readFileSync(commonPath, 'utf-8'));
        byLang[lang] = parsed && typeof parsed === 'object' ? parsed : null;
      } catch (err) {
        console.warn(`[pages] Failed to parse locales/${lang}/common.json:`, err.message);
      }
    }
  }
  _localesCache.byLang = byLang;
  _localesCache.loaded = true;
  return byLang;
}

function harvestExperienceLocales(packId) {
  const byLang = loadAllLocales();
  const nameMap = {};
  const taglineMap = {};
  for (const [lang, common] of Object.entries(byLang)) {
    const entry = common && common.experiences && common.experiences[packId];
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.name === 'string' && entry.name.length > 0) {
      nameMap[lang] = entry.name;
    }
    if (typeof entry.blurb === 'string' && entry.blurb.length > 0) {
      taglineMap[lang] = entry.blurb;
    }
  }
  return { nameMap, taglineMap };
}

function assertCompleteCatalogLocalization(pack, localized) {
  if (pack.requireCompleteLocalization !== true) return;
  const expectedLocales = Object.keys(loadAllLocales());
  for (const [field, values] of Object.entries(localized)) {
    const missing = expectedLocales.filter(
      (lang) => typeof values?.[lang] !== 'string' || !values[lang].trim()
    );
    if (missing.length > 0) {
      throw new Error(
        `[pages] ${pack.id} requires complete ${field}; missing: ${missing.join(', ')}`
      );
    }
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(sourcePath, destPath) {
  if (!fs.existsSync(sourcePath)) {
    console.warn(`[pages] Missing asset: ${sourcePath}`);
    return false;
  }
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(sourcePath, destPath);
  return true;
}

function resolveAssetSource(relativePath) {
  if (!relativePath) return null;
  return path.join(REPO_ROOT, relativePath);
}

function applyBasePath(html) {
  return html.replace(/\{\{BASE_PATH\}\}/g, basePathWithSlash);
}

function resolveLandingDir(pack, outputDir) {
  if (typeof pack.landingUrl === 'string' && pack.landingUrl.trim()) {
    const trimmed = pack.landingUrl.replace(/^\//, '').replace(/\/$/, '');
    if (trimmed) {
      return path.join(outputDir, trimmed);
    }
  }
  return path.join(outputDir, 'corpan', 'packs', pack.id);
}

// The Developer Install block — copy-the-URL section for downloadable packs.
// Built-in experiences (Phrase Flip) ship inside the app and have no
// manifest/zip, so they omit this entirely.
function devInstallSectionHtml() {
  return `<div class="dev-section">
                <h3>Developer Install</h3>
                <p id="install-hint">
                    Install this pack in Corpán: Open Settings, tap the "Developer packs" button 7 times, then paste one of these URLs in the Install from URL section:
                </p>

                <div class="install-options">
                    <div class="install-option" data-install="manifest">
                        <div class="install-option-header">
                            <h4>Web Play</h4>
                            <span class="install-badge">Always Latest</span>
                        </div>
                        <p>Loads from the web each time. Always gets updates automatically.</p>
                        <button class="copy-button" onclick="copyUrl('manifest')">Copy Install URL</button>
                    </div>

                    <div class="install-option" data-install="zip">
                        <div class="install-option-header">
                            <h4>Offline Download</h4>
                            <span class="install-badge">Works Offline</span>
                        </div>
                        <p>Downloads once and works 100% offline after installation.</p>
                        <button class="copy-button" onclick="copyUrl('zip')">Copy Install URL</button>
                    </div>
                </div>
            </div>`;
}

function buildPackLandingPage(pack, outputDir) {
  const gameLandingTemplate = applyBasePath(readTemplate('game-landing'));
  // Built-in core experiences (e.g. Phrase Flip) have no downloadable artifact —
  // no zip/manifest, no dev-install, no version number.
  const builtin = pack.builtin === true;
  const urls = builtin
    ? {}
    : {
        zip: pack.zipUrl || `${basePathWithSlash}corpan/packs/${pack.id}.zip`,
      };
  if (!builtin && pack.manifestUrl) {
    urls.manifest = pack.manifestUrl;
  }
  const versionBlock = builtin
    ? '<p class="version">Included with Corpán</p>'
    : `<p class="version">Version ${pack.version}</p>`;
  const playNote = builtin
    ? 'Built into the Corpán app'
    : 'Play this pack inside the Corpán app';
  const devSection = builtin ? '' : devInstallSectionHtml();
  const githubUrl =
    pack.github ||
    `https://github.com/corpora-inc/encorpora/tree/main/corpan/packs/${pack.id}`;

  // Build video section HTML
  let videoSectionHtml = '';
  const hasVideos = (pack.videos?.shorts && pack.videos.shorts.length > 0) ||
                     (pack.videos?.demos && pack.videos.demos.length > 0);

  if (hasVideos) {
    videoSectionHtml = '<div class="section"><h2>Watch in Action</h2><div class="videos-grid">';

    // Add shorts
    if (pack.videos.shorts) {
      pack.videos.shorts.forEach(videoId => {
        videoSectionHtml += `
          <div class="video-container">
            <iframe src="https://www.youtube.com/embed/${videoId}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen></iframe>
          </div>`;
      });
    }

    // Add demo videos
    if (pack.videos.demos) {
      pack.videos.demos.forEach(videoId => {
        videoSectionHtml += `
          <div class="video-container video-wide">
            <iframe src="https://www.youtube.com/embed/${videoId}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen></iframe>
          </div>`;
      });
    }

    videoSectionHtml += '</div></div>';
  }

  // Replace placeholders
  let html = gameLandingTemplate
    .replace(/\{\{GAME_ID\}\}/g, pack.id)
    .replace(/\{\{GAME_NAME\}\}/g, pack.name)
    .replace(/\{\{GAME_DESCRIPTION\}\}/g, pack.description)
    .replace(/\{\{GAME_VERSION_BLOCK\}\}/g, versionBlock)
    .replace(/\{\{GAME_PLAY_NOTE\}\}/g, playNote)
    .replace('{{DEV_SECTION}}', devSection)
    .replace(/\{\{GAME_AVATAR\}\}/g, pack.avatarUrl || `${basePathWithSlash}assets/${pack.id}-avatar.png`)
    .replace(/\{\{GAME_GITHUB\}\}/g, githubUrl)
    .replace('{{VIDEO_SECTION}}', videoSectionHtml)
    .replace('{{URLS_JSON}}', JSON.stringify(urls));

  // Write file
  const packDir = resolveLandingDir(pack, outputDir);
  ensureDir(packDir);
  fs.writeFileSync(path.join(packDir, 'index.html'), html);
}

function buildPages(outputDir) {
  console.log('Building Corpan pages...');
  console.log(`Output directory: ${outputDir}`);

  // Load data. Each pack carries its English `name` / `description`
  // from packs.json plus optional `nameLocalized` / `descriptionLocalized`
  // maps merged from its manifest.json (see `readManifestLocalized`).
  const packsData = readData('packs').map((pack) => ({
    ...pack,
    version: readManifestVersion(pack),
    ...readManifestLocalized(pack),
    ...readManifestActivities(pack),
  }));
  packsData.forEach(assertCatalogHostCompatibility);
  assertVersionedCompatibilityRoutes(packsData);
  const isListed = (pack) => pack.listed !== false;
  // webListed lets us hide platform-duplicate or legacy-pinned catalog
  // entries from the public packs page while still shipping them in
  // catalog.json / catalog-v3.json for the in-app picker.
  const isWebListed = (pack) => isListed(pack) && pack.webListed !== false;

  // Load templates
  const corpanTemplate = applyBasePath(readTemplate('corpan'));
  const packsTemplate = applyBasePath(readTemplate('packs'));

  // Always write to outputDir directly - GitHub Pages handles base path routing
  const outputRoot = outputDir;
  const assetsDir = path.join(outputRoot, 'assets');

  // Create directory structure for Corpan pages
  ensureDir(path.join(outputRoot, 'corpan'));
  ensureDir(path.join(outputRoot, 'corpan', 'packs'));

  // Copy shared assets from canonical locations
  console.log('Copying assets...');
  copyFileSafe(CORPAN_LOGO_SOURCE, path.join(assetsDir, 'logo-512.png'));

  const packsWithAssets = packsData.map((pack) => {
    const fallbackAvatar = path.join(
      'corpan',
      'packs',
      pack.id,
      `${pack.id}-avatar.png`
    );
    const avatarSourcePath = resolveAssetSource(pack.avatarSource || fallbackAvatar);
    const avatarExt = avatarSourcePath ? path.extname(avatarSourcePath) || '.png' : '.png';
    const avatarFileName = `${pack.id}-avatar${avatarExt}`;
    const avatarDest = path.join(assetsDir, avatarFileName);

    if (avatarSourcePath) {
      copyFileSafe(avatarSourcePath, avatarDest);
    }

    return {
      ...pack,
      avatarUrl: `${basePathWithSlash}assets/${avatarFileName}`,
    };
  });
  const listedPacks = packsWithAssets.filter(isWebListed);

  // Build Corpan page
  console.log('Building corpan/index.html...');
  fs.writeFileSync(path.join(outputRoot, 'corpan', 'index.html'), corpanTemplate);

  // Build Packs listing page
  console.log('Building corpan/packs/index.html...');
  const packsHtml = packsTemplate.replace(
    '{{PACKS_DATA}}',
    JSON.stringify(listedPacks)
  );
  fs.writeFileSync(path.join(outputRoot, 'corpan', 'packs', 'index.html'), packsHtml);

  // Build pack landing pages
  console.log('Building pack landing pages...');
  packsWithAssets.forEach(pack => {
    const landingPath = typeof pack.landingUrl === 'string' && pack.landingUrl.trim()
      ? pack.landingUrl.replace(/^\//, '').replace(/\/$/, '')
      : `corpan/packs/${pack.id}`;
    console.log(`  - ${landingPath}/index.html`);
    buildPackLandingPage(pack, outputRoot);
  });

  // Generate catalog.json (v1) for 0.9.x clients. That schema cannot enforce
  // minAppVersion, so packs requiring newer hosts must opt out explicitly.
  console.log('Generating catalog.json...');
  const isV1Pack = (pack) =>
    isListed(pack) &&
    pack.v1Listed !== false &&
    pack.packType !== 'reader' &&
    pack.builtin !== true;
  const catalogData = packsData.filter(isV1Pack).map(pack => {
    // Use zipUrl if available, otherwise fallback to manifest
    const manifestUrl = pack.zipUrl
      ? (pack.zipUrl.startsWith('/') ? `https://encorpora.io${pack.zipUrl}` : pack.zipUrl)
      : (pack.manifestUrl
        ? (pack.manifestUrl.startsWith('/') ? `https://encorpora.io${pack.manifestUrl}` : pack.manifestUrl)
        : `https://encorpora.io/corpan/packs/${pack.id}.zip`);

    // Get the avatar URL from the processed pack (matches what's copied to assets/)
    const packWithAssets = packsWithAssets.find(p => p.id === pack.id);
    const imageUrl = packWithAssets?.avatarUrl
      ? (packWithAssets.avatarUrl.startsWith('/') ? `https://encorpora.io${packWithAssets.avatarUrl}` : packWithAssets.avatarUrl)
      : `https://encorpora.io/assets/${pack.id}-avatar.png`;

    return {
      id: pack.id,
      name: pack.name,
      ...(pack.nameLocalized ? { nameLocalized: pack.nameLocalized } : {}),
      version: pack.version,
      manifestUrl: manifestUrl,
      description: pack.description,
      ...(pack.descriptionLocalized
        ? { descriptionLocalized: pack.descriptionLocalized }
        : {}),
      imageUrl: imageUrl,
      purchase: { type: "free", priceLabel: "Free" }
    };
  });
  const catalogPath = path.join(outputRoot, 'corpan', 'packs', 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2));

  // Generate catalog-v3.json — includes ALL packs (filtering is client-side)
  console.log('Generating catalog-v3.json...');
  // Built-in experiences (Phrase Flip) ship inside the app — they get a website
  // landing page but must NEVER appear in the in-app catalog, or the Home picker
  // would offer to "download" a pack that has no artifact.
  //
  // Word-explanation packs (`packType: "data"`, e.g. wordpan_es_en) are a
  // SEPARATE KIND of artifact: they are distributed via the dedicated S3
  // word-pack index (corpan/word-packs/index.json), discovered in Settings /
  // the Phrase Flip long-press popover, and must NEVER appear in catalog-v3 /
  // on Home. Excluding them by type here is the structural fix for the leak
  // that #498 introduced — `listed: false` alone does NOT keep an entry out of
  // catalog-v3 (filtering here was builtin-only), which was the bug. Any
  // remaining packs.json entry is a website-landing / compat route only.
  const catalogV3Packs = packsWithAssets
    .filter((pack) => pack.builtin !== true && pack.packType !== 'data')
    .map(pack => {
    const zipUrl = pack.zipUrl
      ? (pack.zipUrl.startsWith('/') ? `https://encorpora.io${pack.zipUrl}` : pack.zipUrl)
      : `https://encorpora.io/corpan/packs/${pack.id}.zip`;
    const manifestUrl = pack.manifestUrl
      ? (pack.manifestUrl.startsWith('/') ? `https://encorpora.io${pack.manifestUrl}` : pack.manifestUrl)
      : undefined;
    const imageUrl = pack.avatarUrl
      ? (pack.avatarUrl.startsWith('/') ? `https://encorpora.io${pack.avatarUrl}` : pack.avatarUrl)
      : `https://encorpora.io/assets/${pack.id}-avatar.png`;

    // Merge `experiences.<id>.{name, blurb}` translations from every locale's
    // common.json into the catalog so the Home picker can render localized
    // text from catalog fields without any baked-in i18n keys. The pack's own
    // manifest-derived nameLocalized (if any) wins over the experiences map
    // for `name` since the manifest is the authored marketing surface; the
    // experiences map fills in the locales the manifest didn't cover.
    const { nameMap, taglineMap } = harvestExperienceLocales(pack.id);
    const nameLocalized = {
      ...nameMap,
      ...(pack.nameLocalized || {}),
    };
    if (typeof pack.name === 'string' && pack.name.length > 0) {
      nameLocalized.en = pack.name;
    }
    const taglineLocalized = { ...taglineMap };
    if (typeof pack.tagline === 'string' && pack.tagline.length > 0) {
      taglineLocalized.en = pack.tagline;
    }
    assertCompleteCatalogLocalization(pack, {
      nameLocalized,
      descriptionLocalized: pack.descriptionLocalized,
      taglineLocalized,
    });

    return {
      id: pack.id,
      name: pack.name,
      ...(Object.keys(nameLocalized).length > 0
        ? { nameLocalized }
        : {}),
      version: pack.version,
      manifestUrl: manifestUrl,
      zipUrl: zipUrl,
      description: pack.description,
      ...(pack.descriptionLocalized
        ? { descriptionLocalized: pack.descriptionLocalized }
        : {}),
      imageUrl: imageUrl,
      purchase: pack.purchase || { type: "free", priceLabel: "Free" },
      minAppVersion: pack.minAppVersion || "0.9.0",
      ...(pack.maxAppVersion ? { maxAppVersion: pack.maxAppVersion } : {}),
      channel: pack.channel || "stable",
      packType: pack.packType || "game",
      // System packs auto-install on launch (SystemPackInstaller) — no user
      // action. Tiny core interludes (wordfall, drift) ride this path so they
      // are present the moment the Journey scroll wants to schedule one.
      ...(pack.systemPack === true ? { systemPack: true } : {}),
      // Journey activity declarations (forwarded verbatim from the manifest by
      // readManifestActivities) — lets the Journey scheduler discover which
      // installed packs can serve as game/reader interludes.
      ...(pack.activities ? { activities: pack.activities } : {}),
      ...(Array.isArray(pack.platforms) && pack.platforms.length > 0
        ? { platforms: pack.platforms }
        : {}),
      ...(pack.minOSVersion ? { minOSVersion: pack.minOSVersion } : {}),
      // Recommendation metadata. Lets us re-shuffle / re-tag experiences
      // on the Home picker without an app release. Mirrors the fields on
      // `CatalogGame` / `CatalogV3Entry` and the in-binary registry
      // (`corpan-app/src/experiences/registry.ts`), which remains as a
      // defensive offline fallback for first-launch-without-network.
      ...(Array.isArray(pack.categories) && pack.categories.length > 0
        ? { categories: pack.categories }
        : {}),
      ...(Array.isArray(pack.goodForClass) && pack.goodForClass.length > 0
        ? { goodForClass: pack.goodForClass }
        : {}),
      ...(typeof pack.recommendOrder === 'number'
        ? { recommendOrder: pack.recommendOrder }
        : {}),
      ...(Array.isArray(pack.featuredFor) && pack.featuredFor.length > 0
        ? { featuredFor: pack.featuredFor }
        : {}),
      ...(typeof pack.kidFriendly === 'boolean'
        ? { kidFriendly: pack.kidFriendly }
        : {}),
      ...(Array.isArray(pack.languages) && pack.languages.length > 0
        ? { languages: pack.languages }
        : {}),
      ...(typeof pack.tagline === 'string' && pack.tagline.length > 0
        ? { tagline: pack.tagline }
        : {}),
      ...(Object.keys(taglineLocalized).length > 0
        ? { taglineLocalized }
        : {}),
      // Optional phrase-pack-specific fields. Surface only when defined on
      // the pack entry — keeps the catalog tight for game/reader/narration
      // packs that don't use them. See PHRASE_PACK_AUTHORING.md.
      ...(Array.isArray(pack.tags) && pack.tags.length > 0
        ? { tags: pack.tags }
        : {}),
      ...(typeof pack.sizeMb === 'number' ? { sizeMb: pack.sizeMb } : {}),
      ...(pack.category ? { category: pack.category } : {}),
      ...(pack.topic ? { topic: pack.topic } : {}),
      ...(pack.levelMin ? { levelMin: pack.levelMin } : {}),
      ...(pack.levelMax ? { levelMax: pack.levelMax } : {}),
      ...(typeof pack.entryCount === 'number'
        ? { entryCount: pack.entryCount }
        : {}),
      ...(typeof pack.languageCount === 'number'
        ? { languageCount: pack.languageCount }
        : {}),
    };
  });
  // Catalog-level curation for phrase packs (optional file). Lets the
  // publishing agent re-order the onboarding starter set and rebrand
  // browser groupings without touching packs.json or the app.
  const phrasePackConfig = readDataOptional('phrasePackConfig');
  const onboardingStarterPackIds = Array.isArray(
    phrasePackConfig?.onboardingStarterPackIds,
  )
    ? phrasePackConfig.onboardingStarterPackIds.filter(
        (id) => typeof id === 'string' && id.length > 0,
      )
    : undefined;
  const phrasePackGroups = Array.isArray(phrasePackConfig?.phrasePackGroups)
    ? phrasePackConfig.phrasePackGroups
        .filter((g) => g && typeof g === 'object' && typeof g.id === 'string' && typeof g.label === 'string' && Array.isArray(g.packIds))
        .map((g) => ({
          id: g.id,
          label: g.label,
          ...(typeof g.description === 'string' ? { description: g.description } : {}),
          packIds: g.packIds.filter((id) => typeof id === 'string' && id.length > 0),
        }))
        .filter((g) => g.packIds.length > 0)
    : undefined;
  const catalogV3 = {
    version: 3,
    generatedAt: new Date().toISOString(),
    packs: catalogV3Packs,
    ...(onboardingStarterPackIds && onboardingStarterPackIds.length > 0
      ? { onboardingStarterPackIds }
      : {}),
    ...(phrasePackGroups && phrasePackGroups.length > 0
      ? { phrasePackGroups }
      : {}),
  };
  const catalogV3Path = path.join(outputRoot, 'corpan', 'packs', 'catalog-v3.json');
  fs.writeFileSync(catalogV3Path, JSON.stringify(catalogV3, null, 2));

  console.log('✓ Corpan pages built successfully!');
  console.log('\nGenerated:');
  console.log('  - corpan/index.html');
  console.log('  - corpan/packs/index.html');
  console.log('  - corpan/packs/catalog.json');
  console.log('  - corpan/packs/catalog-v3.json');
  packsWithAssets.forEach(pack => {
    console.log(`  - corpan/packs/${pack.id}/index.html`);
  });
  console.log('  - assets/ (images)');
}

// Main
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Error: Output directory required');
  console.error('Usage: node build.js <output-dir>');
  process.exit(1);
}

const outputDir = path.resolve(args[0]);
buildPages(outputDir);
