#!/usr/bin/env node
/**
 * Watch game builds and copy to io/out when they change
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, 'corpan', 'games');

const normalizeBasePath = (value) => {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return normalized.replace(/\/$/, '');
};

const basePath = normalizeBasePath(process.env.ENCORPORA_BASE_PATH);
const outputRoot = basePath
  ? path.join(__dirname, 'io', 'out', basePath.replace(/^\//, ''))
  : path.join(__dirname, 'io', 'out');
const OUTPUT_DIR = path.join(outputRoot, 'corpan', 'games');

function copyGame(gameName) {
  const srcDir = path.join(GAMES_DIR, gameName, 'dist');
  const srcManifest = path.join(GAMES_DIR, gameName, 'manifest.json');
  const destDir = path.join(OUTPUT_DIR, gameName);

  if (!fs.existsSync(srcDir)) {
    console.log(`[watch-games] ${gameName} dist/ not found, skipping...`);
    return;
  }

  console.log(`[watch-games] Copying ${gameName}...`);

  try {
    // Create destination directory
    execSync(`mkdir -p "${destDir}"`, { stdio: 'inherit' });

    // Copy manifest
    if (fs.existsSync(srcManifest)) {
      execSync(`cp "${srcManifest}" "${destDir}/"`, { stdio: 'inherit' });
    }

    // Copy dist contents
    execSync(`cp -R "${srcDir}/." "${destDir}/"`, { stdio: 'inherit' });

    console.log(`[watch-games] ✓ ${gameName} copied`);
  } catch (error) {
    console.error(`[watch-games] ✗ Failed to copy ${gameName}:`, error.message);
  }
}

// Initial copy
console.log('[watch-games] Starting watch mode...');
console.log('[watch-games] Copying hover-runner...');
copyGame('hover-runner');

// Watch for changes in game dist directories
const watchPaths = [
  path.join(GAMES_DIR, 'hover-runner', 'dist', '**', '*'),
  path.join(GAMES_DIR, 'hover-runner', 'manifest.json')
];

console.log('[watch-games] Setting up watchers for:');
watchPaths.forEach(p => console.log(`  ${p}`));

const watcher = chokidar.watch(watchPaths, {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 200,
    pollInterval: 100
  }
});

let timeout;
watcher.on('all', (event, filepath) => {
  const gameName = path.relative(GAMES_DIR, filepath).split(path.sep)[0];
  console.log(`[watch-games] ${event}: ${path.relative(__dirname, filepath)}`);

  // Debounce copies
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    copyGame(gameName);
  }, 200);
});

watcher.on('ready', () => {
  console.log('[watch-games] ✓ Watchers ready');
  console.log('[watch-games] Watching for game changes...');
});

watcher.on('error', error => {
  console.error('[watch-games] ✗ Watcher error:', error);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('[watch-games] Stopping watch...');
  watcher.close();
  process.exit(0);
});
