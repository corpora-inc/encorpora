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

function buildPages(outputDir) {
  console.log('Building GitHub Pages site...');
  console.log(`Output directory: ${outputDir}`);

  // Load data
  const appsData = readData('apps');
  const gamesData = readData('games');

  // Load templates
  const rootTemplate = readTemplate('root');
  const corpanTemplate = readTemplate('corpan');
  const gamesTemplate = readTemplate('games');

  // Create directory structure
  ensureDir(outputDir);
  ensureDir(path.join(outputDir, 'corpan'));
  ensureDir(path.join(outputDir, 'corpan', 'games'));

  // Build root page
  console.log('Building root index.html...');
  const rootHtml = rootTemplate.replace(
    '{{APPS_DATA}}',
    JSON.stringify(appsData)
  );
  fs.writeFileSync(path.join(outputDir, 'index.html'), rootHtml);

  // Build Corpan page
  console.log('Building corpan/index.html...');
  fs.writeFileSync(path.join(outputDir, 'corpan', 'index.html'), corpanTemplate);

  // Build Games listing page
  console.log('Building corpan/games/index.html...');
  const gamesHtml = gamesTemplate.replace(
    '{{GAMES_DATA}}',
    JSON.stringify(gamesData)
  );
  fs.writeFileSync(path.join(outputDir, 'corpan', 'games', 'index.html'), gamesHtml);

  console.log('✓ Site built successfully!');
  console.log('\nGenerated pages:');
  console.log('  - index.html (root)');
  console.log('  - corpan/index.html');
  console.log('  - corpan/games/index.html');
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
