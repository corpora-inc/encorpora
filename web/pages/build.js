#!/usr/bin/env node
/**
 * Build script for generating GitHub Pages site structure
 *
 * This script generates landing pages at each level:
 * - Root: /index.html
 * - Corpan: /corpan/index.html
 * - Games: /corpan/games/index.html
 *
 * Usage: node build.js <output-dir>
 */

const fs = require('fs');
const path = require('path');

// Paths
const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..');
const TEMPLATES_DIR = path.join(SCRIPT_DIR, 'templates');
const DATA_DIR = path.join(SCRIPT_DIR, 'data');
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

function buildGameLandingPage(game, outputDir) {
  const gameLandingTemplate = applyBasePath(readTemplate('game-landing'));

  // Build video section HTML
  let videoSectionHtml = '';
  const hasVideos = (game.videos?.shorts && game.videos.shorts.length > 0) ||
                     (game.videos?.demos && game.videos.demos.length > 0);

  if (hasVideos) {
    videoSectionHtml = '<div class="section"><h2>Watch in Action</h2><div class="videos-grid">';

    // Add shorts
    if (game.videos.shorts) {
      game.videos.shorts.forEach(videoId => {
        videoSectionHtml += `
          <div class="video-container">
            <iframe src="https://www.youtube.com/embed/${videoId}"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen></iframe>
          </div>`;
      });
    }

    // Add demo videos
    if (game.videos.demos) {
      game.videos.demos.forEach(videoId => {
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
    .replace(/\{\{GAME_ID\}\}/g, game.id)
    .replace(/\{\{GAME_NAME\}\}/g, game.name)
    .replace(/\{\{GAME_DESCRIPTION\}\}/g, game.description)
    .replace(/\{\{GAME_VERSION\}\}/g, game.version)
    .replace(/\{\{GAME_AVATAR\}\}/g, game.avatarUrl || `${basePathWithSlash}assets/${game.id}-avatar.png`)
    .replace('{{VIDEO_SECTION}}', videoSectionHtml);

  // Write file
  const gameDir = path.join(outputDir, 'corpan', 'games', game.id);
  ensureDir(gameDir);
  fs.writeFileSync(path.join(gameDir, 'index.html'), html);
}

function buildPages(outputDir) {
  console.log('Building Corpan pages...');
  console.log(`Output directory: ${outputDir}`);

  // Load data
  const gamesData = readData('games');

  // Load templates
  const corpanTemplate = applyBasePath(readTemplate('corpan'));
  const gamesTemplate = applyBasePath(readTemplate('games'));

  // Always write to outputDir directly - GitHub Pages handles base path routing
  const outputRoot = outputDir;
  const assetsDir = path.join(outputRoot, 'assets');

  // Create directory structure for Corpan pages
  ensureDir(path.join(outputRoot, 'corpan'));
  ensureDir(path.join(outputRoot, 'corpan', 'games'));

  // Copy shared assets from canonical locations
  console.log('Copying assets...');
  copyFileSafe(CORPAN_LOGO_SOURCE, path.join(assetsDir, 'logo-512.png'));

  const gamesWithAssets = gamesData.map((game) => {
    const fallbackAvatar = path.join(
      'corpan',
      'games',
      game.id,
      `${game.id}-avatar.png`
    );
    const avatarSourcePath = resolveAssetSource(game.avatarSource || fallbackAvatar);
    const avatarExt = avatarSourcePath ? path.extname(avatarSourcePath) || '.png' : '.png';
    const avatarFileName = `${game.id}-avatar${avatarExt}`;
    const avatarDest = path.join(assetsDir, avatarFileName);

    if (avatarSourcePath) {
      copyFileSafe(avatarSourcePath, avatarDest);
    }

    return {
      ...game,
      avatarUrl: `${basePathWithSlash}assets/${avatarFileName}`,
    };
  });

  // Build Corpan page
  console.log('Building corpan/index.html...');
  fs.writeFileSync(path.join(outputRoot, 'corpan', 'index.html'), corpanTemplate);

  // Build Games listing page
  console.log('Building corpan/games/index.html...');
  const gamesHtml = gamesTemplate.replace(
    '{{GAMES_DATA}}',
    JSON.stringify(gamesWithAssets)
  );
  fs.writeFileSync(path.join(outputRoot, 'corpan', 'games', 'index.html'), gamesHtml);

  // Build game landing pages
  console.log('Building game landing pages...');
  gamesWithAssets.forEach(game => {
    console.log(`  - corpan/games/${game.id}/index.html`);
    buildGameLandingPage(game, outputRoot);
  });

  console.log('✓ Corpan pages built successfully!');
  console.log('\nGenerated:');
  console.log('  - corpan/index.html');
  console.log('  - corpan/games/index.html');
  gamesWithAssets.forEach(game => {
    console.log(`  - corpan/games/${game.id}/index.html`);
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
