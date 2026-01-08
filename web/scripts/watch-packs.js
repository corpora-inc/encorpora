#!/usr/bin/env node
/**
 * Watch pack builds and copy to web/io/out when they change
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKS_DIR = path.join(__dirname, '..', '..', 'corpan', 'packs');
const OUTPUT_DIR = path.join(__dirname, '..', 'io', 'out', 'corpan', 'packs');

const PACK_CONFIGS = [
  {
    name: 'hover-runner',
    distDir: 'dist',
    files: ['manifest.json']
  },
  {
    name: 'hanzipan',
    distDir: null,
    files: ['manifest.json', 'index.js', 'styles.css', 'hanziwriter.min.js', 'HANZIWRITER_LICENSE.txt'],
    dirs: ['data'],
    zipName: 'hanzipan.zip',
    zipEntries: ['manifest.json', 'index.js', 'styles.css', 'hanziwriter.min.js', 'HANZIWRITER_LICENSE.txt', 'data/']
  }
];

const PACK_CONFIG_MAP = new Map(PACK_CONFIGS.map((config) => [config.name, config]));

function bumpDevRevision(manifestPath) {
  if (!fs.existsSync(manifestPath)) return;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    data.devRevision = String(Date.now());
    fs.writeFileSync(manifestPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.error(`[watch-packs] ✗ Failed to update devRevision:`, error.message);
  }
}

function copyPack(packName) {
  const config = PACK_CONFIG_MAP.get(packName);
  if (!config) {
    console.log(`[watch-packs] ${packName} not configured, skipping...`);
    return;
  }

  const destDir = path.join(OUTPUT_DIR, packName);
  const srcRoot = path.join(PACKS_DIR, packName);
  const srcDir = config.distDir ? path.join(srcRoot, config.distDir) : null;

  if (srcDir && !fs.existsSync(srcDir)) {
    console.log(`[watch-packs] ${packName} ${config.distDir}/ not found, skipping...`);
    return;
  }

  console.log(`[watch-packs] Copying ${packName}...`);

  try {
    // Create destination directory
    execSync(`mkdir -p "${destDir}"`, { stdio: 'inherit' });

    // Copy files
    (config.files || []).forEach((fileName) => {
      const srcFile = path.join(srcRoot, fileName);
      if (!fs.existsSync(srcFile)) {
        return;
      }
      execSync(`cp "${srcFile}" "${destDir}/"`, { stdio: 'inherit' });
    });

    // Copy dist directory (keep the folder structure)
    if (srcDir) {
      execSync(`cp -R "${srcDir}" "${destDir}/"`, { stdio: 'inherit' });
    }

    // Copy any additional directories
    (config.dirs || []).forEach((dirName) => {
      const srcPath = path.join(srcRoot, dirName);
      if (!fs.existsSync(srcPath)) {
        return;
      }
      execSync(`cp -R "${srcPath}" "${destDir}/"`, { stdio: 'inherit' });
    });

    const destManifest = path.join(destDir, 'manifest.json');
    bumpDevRevision(destManifest);

    // Build zip (if configured)
    if (config.zipName && config.zipEntries?.length) {
      const entries = config.zipEntries.map((entry) => `"${entry}"`).join(' ');
      try {
        execSync(`cd "${srcRoot}" && zip -r -FS "${config.zipName}" ${entries}`, {
          stdio: 'inherit'
        });
        execSync(`mkdir -p "${OUTPUT_DIR}"`, { stdio: 'inherit' });
        const zipPath = path.join(srcRoot, config.zipName);
        if (fs.existsSync(zipPath)) {
          execSync(`cp "${zipPath}" "${OUTPUT_DIR}/"`, { stdio: 'inherit' });
        }
      } catch (zipError) {
        console.error(`[watch-packs] ✗ Failed to package ${packName}:`, zipError.message);
      }
    }

    console.log(`[watch-packs] ✓ ${packName} copied`);
  } catch (error) {
    console.error(`[watch-packs] ✗ Failed to copy ${packName}:`, error.message);
  }
}

// Initial copy
console.log('[watch-packs] Starting watch mode...');
console.log('[watch-packs] Copying packs...');
PACK_CONFIGS.forEach((config) => copyPack(config.name));

// Watch for changes in pack dist directories
const watchPaths = PACK_CONFIGS.flatMap((config) => {
  const base = path.join(PACKS_DIR, config.name);
  const paths = [];
  if (config.distDir) {
    paths.push(path.join(base, config.distDir, '**', '*'));
  }
  (config.files || []).forEach((fileName) => {
    paths.push(path.join(base, fileName));
  });
  (config.dirs || []).forEach((dirName) => {
    paths.push(path.join(base, dirName, '**', '*'));
  });
  return paths;
});

console.log('[watch-packs] Setting up watchers for:');
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
  const packName = path.relative(PACKS_DIR, filepath).split(path.sep)[0];
  console.log(`[watch-packs] ${event}: ${path.relative(__dirname, filepath)}`);

  // Debounce copies
  clearTimeout(timeout);
  timeout = setTimeout(() => {
    copyPack(packName);
  }, 200);
});

watcher.on('ready', () => {
  console.log('[watch-packs] ✓ Watchers ready');
  console.log('[watch-packs] Watching for pack changes...');
});

watcher.on('error', error => {
  console.error('[watch-packs] ✗ Watcher error:', error);
});

// Handle cleanup
process.on('SIGINT', () => {
  console.log('[watch-packs] Stopping watch...');
  watcher.close();
  process.exit(0);
});
