#!/usr/bin/env node
/**
 * Watch script for Corpan pages
 * Rebuilds pages when templates or data change
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..');
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
const watchPaths = [
  path.join(SCRIPT_DIR, 'templates', '**', '*.html'),
  path.join(SCRIPT_DIR, '..', 'data', '**', '*.json'),
  path.join(REPO_ROOT, 'corpan', 'corpan-app', 'src-tauri', 'icons', '512x512.png'),
  path.join(REPO_ROOT, 'corpan', 'packs', '**', '*-avatar.*')
];

console.log('[pages] Setting up watchers for:');
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
const handleChange = (filepath, event) => {
  const relative = path.relative(SCRIPT_DIR, filepath);
  console.log(`[pages] ${event || 'Changed'}: ${relative}`);

  // Debounce builds
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    build();
  }, 200);
};

watcher.on('change', (filepath) => handleChange(filepath, 'Changed'));
watcher.on('add', (filepath) => handleChange(filepath, 'Added'));
watcher.on('unlink', (filepath) => handleChange(filepath, 'Removed'));

watcher.on('ready', () => {
  console.log('[pages] ✓ Watchers ready');
  console.log('[pages] Watching:');
  console.log('  - templates/**/*.html');
  console.log('  - data/**/*.json');
  console.log('  - corpan/corpan-app/src-tauri/icons/512x512.png');
  console.log('  - corpan/packs/**/**/*-avatar.*');
  console.log('[pages] Try editing a file to trigger rebuild...');
});

watcher.on('error', error => {
  console.error('[pages] ✗ Watcher error:', error);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('[pages] Stopping watch...');
  watcher.close();
  process.exit(0);
});
