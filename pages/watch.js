#!/usr/bin/env node
/**
 * Watch script for Corpan pages
 * Rebuilds pages when templates or data change
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = path.join(SCRIPT_DIR, '..', 'io', 'out');

function build() {
  console.log('[pages] Rebuilding Corpan pages...');
  try {
    execSync(`node "${path.join(SCRIPT_DIR, 'build.js')}" "${OUTPUT_DIR}"`, {
      stdio: 'inherit'
    });
    console.log('[pages] ✓ Rebuild complete');
  } catch (error) {
    console.error('[pages] ✗ Build failed:', error.message);
  }
}

// Initial build
console.log('[pages] Starting watch mode...');
build();

// Watch for changes
const watcher = chokidar.watch([
  path.join(SCRIPT_DIR, 'templates', '**', '*.html'),
  path.join(SCRIPT_DIR, 'data', '**', '*.json'),
  path.join(SCRIPT_DIR, 'assets', '**', '*')
], {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 100,
    pollInterval: 50
  }
});

let timeout;
const handleChange = (filepath) => {
  const relative = path.relative(SCRIPT_DIR, filepath);
  console.log(`[pages] Changed: ${relative}`);

  // Debounce builds
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    build();
  }, 100);
};

watcher.on('change', handleChange);
watcher.on('add', handleChange);
watcher.on('unlink', handleChange);

watcher.on('ready', () => {
  console.log('[pages] Watching for changes...');
  console.log('[pages] Watching:');
  console.log('  - templates/**/*.html');
  console.log('  - data/**/*.json');
  console.log('  - assets/**/*');
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('[pages] Stopping watch...');
  watcher.close();
  process.exit(0);
});
