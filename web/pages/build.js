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

function readManifestVersion(pack) {
  const manifestPath = resolveManifestPath(pack);
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.warn(`[pages] Missing manifest for ${pack.id}, using 0.0.0`);
    return "0.0.0";
  }
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (manifest && typeof manifest.version === 'string' && manifest.version.trim()) {
      return manifest.version.trim();
    }
  } catch (error) {
    console.warn(`[pages] Failed to read manifest for ${pack.id}:`, error);
  }
  return "0.0.0";
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

function buildPackLandingPage(pack, outputDir) {
  const gameLandingTemplate = applyBasePath(readTemplate('game-landing'));
  const urls = {
    zip: pack.zipUrl || `${basePathWithSlash}corpan/packs/${pack.id}.zip`
  };
  if (pack.manifestUrl) {
    urls.manifest = pack.manifestUrl;
  }
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
    .replace(/\{\{GAME_VERSION\}\}/g, pack.version)
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

  // Load data
  const packsData = readData('packs').map((pack) => ({
    ...pack,
    version: readManifestVersion(pack),
  }));
  const isListed = (pack) => pack.listed !== false;

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
  const listedPacks = packsWithAssets.filter(isListed);

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

  // Generate catalog.json (v1) for app consumption — only games for 0.9.x
  console.log('Generating catalog.json...');
  const isV1Pack = (pack) => isListed(pack) && pack.packType !== 'reader';
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
      version: pack.version,
      manifestUrl: manifestUrl,
      description: pack.description,
      imageUrl: imageUrl,
      purchase: { type: "free", priceLabel: "Free" }
    };
  });
  const catalogPath = path.join(outputRoot, 'corpan', 'packs', 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify(catalogData, null, 2));

  // Generate catalog-v3.json — includes ALL packs (filtering is client-side)
  console.log('Generating catalog-v3.json...');
  const catalogV3Packs = packsWithAssets.map(pack => {
    const zipUrl = pack.zipUrl
      ? (pack.zipUrl.startsWith('/') ? `https://encorpora.io${pack.zipUrl}` : pack.zipUrl)
      : `https://encorpora.io/corpan/packs/${pack.id}.zip`;
    const manifestUrl = pack.manifestUrl
      ? (pack.manifestUrl.startsWith('/') ? `https://encorpora.io${pack.manifestUrl}` : pack.manifestUrl)
      : undefined;
    const imageUrl = pack.avatarUrl
      ? (pack.avatarUrl.startsWith('/') ? `https://encorpora.io${pack.avatarUrl}` : pack.avatarUrl)
      : `https://encorpora.io/assets/${pack.id}-avatar.png`;

    return {
      id: pack.id,
      name: pack.name,
      version: pack.version,
      manifestUrl: manifestUrl,
      zipUrl: zipUrl,
      description: pack.description,
      imageUrl: imageUrl,
      purchase: { type: "free", priceLabel: "Free" },
      minAppVersion: pack.minAppVersion || "0.9.0",
      channel: pack.channel || "stable",
      packType: pack.packType || "game",
    };
  });
  const catalogV3 = {
    version: 3,
    generatedAt: new Date().toISOString(),
    packs: catalogV3Packs,
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
