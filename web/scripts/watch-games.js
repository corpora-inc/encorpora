#!/usr/bin/env node
/**
 * Watch game builds and copy to web/io/out when they change
 */

const chokidar = require('chokidar');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '..', '..', 'corpan', 'games');
const OUTPUT_DIR = path.join(__dirname, '..', 'io', 'out', 'corpan', 'games');

const GAME_CONFIGS = [
  {
    name: 'hover-runner',
    distDir: 'dist',
    files: ['manifest.json']
  },
  {
    name: 'hanzi-atelier',
    distDir: null,
    files: ['manifest.json', 'index.js', 'styles.css', 'hanziwriter.min.js', 'HANZIWRITER_LICENSE.txt'],
    dirs: ['data'],
    zipName: 'hanzi-atelier.zip',
    zipEntries: ['manifest.json', 'index.js', 'styles.css', 'hanziwriter.min.js', 'HANZIWRITER_LICENSE.txt', 'data/']
  }
];

const GAME_CONFIG_MAP = new Map(GAME_CONFIGS.map((config) => [config.name, config]));

function bumpDevRevision(manifestPath) {
  if (!fs.existsSync(manifestPath)) return;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const data = JSON.parse(raw);
    data.devRevision = String(Date.now());
    fs.writeFileSync(manifestPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.error(`[watch-games] ✗ Failed to update devRevision:`, error.message);
  }
}

function copyGame(gameName) {
  const config = GAME_CONFIG_MAP.get(gameName);
  if (!config) {
    console.log(`[watch-games] ${gameName} not configured, skipping...`);
    return;
  }

  const destDir = path.join(OUTPUT_DIR, gameName);
  const srcRoot = path.join(GAMES_DIR, gameName);
  const srcDir = config.distDir ? path.join(srcRoot, config.distDir) : null;

  if (srcDir && !fs.existsSync(srcDir)) {
    console.log(`[watch-games] ${gameName} ${config.distDir}/ not found, skipping...`);
    return;
  }

  console.log(`[watch-games] Copying ${gameName}...`);

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
        console.error(`[watch-games] ✗ Failed to package ${gameName}:`, zipError.message);
      }
    }

    console.log(`[watch-games] ✓ ${gameName} copied`);
  } catch (error) {
    console.error(`[watch-games] ✗ Failed to copy ${gameName}:`, error.message);
  }
}

// Initial copy
console.log('[watch-games] Starting watch mode...');
console.log('[watch-games] Copying games...');
GAME_CONFIGS.forEach((config) => copyGame(config.name));

// Watch for changes in game dist directories
const watchPaths = GAME_CONFIGS.flatMap((config) => {
  const base = path.join(GAMES_DIR, config.name);
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
