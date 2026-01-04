#!/usr/bin/env node
/**
 * Watch game builds and copy to io/out when they change
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, 'corpan', 'games');
const OUTPUT_DIR = path.join(__dirname, 'io', 'out', 'corpan', 'games');

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
const watcher = chokidar.watch([
  path.join(GAMES_DIR, 'hover-runner', 'dist', '**', '*'),
  path.join(GAMES_DIR, 'hover-runner', 'manifest.json')
], {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true
});

let timeout;
watcher.on('all', (event, filepath) => {
  const gameName = path.relative(GAMES_DIR, filepath).split(path.sep)[0];
  console.log(`[watch-games] Changed: ${path.relative(__dirname, filepath)}`);

  // Debounce copies
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    copyGame(gameName);
  }, 100);
});

console.log('[watch-games] Watching for game changes...');

// Handle cleanup
process.on('SIGINT', () => {
  console.log('[watch-games] Stopping watch...');
  watcher.close();
  process.exit(0);
});
