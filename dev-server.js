#!/usr/bin/env node
/**
 * Development server that composes:
 * - Next.js dev server (io/) at root
 * - Static Corpan pages from io/out/corpan
 * - Static game builds from io/out/corpan/games
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const DEV_PORT = 8000;
const NEXT_PORT = 3000;
const OUT_DIR = path.join(__dirname, 'io', 'out');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function getMimeType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function serveStaticFile(filepath, res) {
  fs.readFile(filepath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const mimeType = getMimeType(filepath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

function proxyToNext(req, res) {
  const options = {
    hostname: 'localhost',
    port: NEXT_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxy = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error('[dev-server] Proxy error:', err.message);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Bad Gateway - Is Next.js dev server running?');
  });

  req.pipe(proxy);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${DEV_PORT}`);
  const pathname = url.pathname;

  // Serve static files for /corpan and /assets
  if (pathname.startsWith('/corpan') || pathname.startsWith('/assets')) {
    let filepath = path.join(OUT_DIR, pathname);

    // If it's a directory, try index.html
    if (fs.existsSync(filepath) && fs.statSync(filepath).isDirectory()) {
      filepath = path.join(filepath, 'index.html');
    }

    if (fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
      console.log(`[dev-server] Static: ${pathname}`);
      serveStaticFile(filepath, res);
      return;
    }
  }

  // Proxy everything else to Next.js
  console.log(`[dev-server] Proxy: ${pathname} → Next.js`);
  proxyToNext(req, res);
});

server.listen(DEV_PORT, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  🚀 Development server running');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`  Local:   http://localhost:${DEV_PORT}`);
  console.log('');
  console.log('  Routes:');
  console.log('  • /                  → Next.js (hot reload)');
  console.log('  • /corpan            → Static (auto rebuild)');
  console.log('  • /corpan/games      → Static (auto rebuild)');
  console.log('  • /assets            → Static');
  console.log('');
  console.log('  Press Ctrl+C to stop');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[dev-server] Port ${DEV_PORT} is already in use`);
    process.exit(1);
  } else {
    console.error('[dev-server] Server error:', err);
  }
});
