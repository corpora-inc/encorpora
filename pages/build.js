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
const TEMPLATES_DIR = path.join(SCRIPT_DIR, 'templates');
const DATA_DIR = path.join(SCRIPT_DIR, 'data');
const ASSETS_DIR = path.join(SCRIPT_DIR, 'assets');

function normalizeBasePath(value) {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return normalized.replace(/\/$/, '');
}

const basePath = normalizeBasePath(process.env.ENCORPORA_BASE_PATH);
const basePathWithSlash = basePath ? `${basePath}/` : '/';

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

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
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
    .replace(/\{\{GAME_AVATAR\}\}/g, `${basePathWithSlash}assets/${game.id}-avatar.png`)
    .replace('{{VIDEO_SECTION}}', videoSectionHtml);

  // Write file
  const gameDir = path.join(outputDir, 'corpan', 'games', game.id);
  ensureDir(gameDir);
  fs.writeFileSync(path.join(gameDir, 'index.html'), html);
}

function buildPages(outputDir, options = {}) {
  console.log('Building Corpan pages...');
  console.log(`Output directory: ${outputDir}`);
  if (basePath) {
    console.log(`Base path: ${basePath}`);
  }

  // Load data
  const gamesData = readData('games');

  // Load templates
  const corpanTemplate = applyBasePath(readTemplate('corpan'));
  const gamesTemplate = applyBasePath(readTemplate('games'));

  const outputRoot = basePath
    ? path.join(outputDir, basePath.replace(/^\//, ''))
    : outputDir;

  // Create directory structure for Corpan pages
  ensureDir(path.join(outputRoot, 'corpan'));
  ensureDir(path.join(outputRoot, 'corpan', 'games'));

  // Build Corpan page
  console.log('Building corpan/index.html...');
  fs.writeFileSync(path.join(outputRoot, 'corpan', 'index.html'), corpanTemplate);

  // Build Games listing page
  console.log('Building corpan/games/index.html...');
  const gamesHtml = gamesTemplate.replace(
    '{{GAMES_DATA}}',
    JSON.stringify(gamesData)
  );
  fs.writeFileSync(path.join(outputRoot, 'corpan', 'games', 'index.html'), gamesHtml);

  // Build game landing pages
  console.log('Building game landing pages...');
  gamesData.forEach(game => {
    console.log(`  - corpan/games/${game.id}/index.html`);
    buildGameLandingPage(game, outputRoot);
  });

  // Copy assets directory
  console.log('Copying assets...');
  if (fs.existsSync(ASSETS_DIR)) {
    copyDir(ASSETS_DIR, path.join(outputRoot, 'assets'));
  }

  console.log('✓ Corpan pages built successfully!');
  console.log('\nGenerated:');
  console.log('  - corpan/index.html');
  console.log('  - corpan/games/index.html');
  gamesData.forEach(game => {
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
