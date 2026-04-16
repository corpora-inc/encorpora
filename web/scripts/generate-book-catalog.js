#!/usr/bin/env node
/**
 * Generate book catalog data for the Next.js site.
 *
 * Scans books/** /pack/manifest.json and produces:
 *   - web/io/data/book-catalog.json      (series/book metadata)
 *   - web/io/data/segments/<bookId>-ch1.json  (first chapter for web preview)
 *
 * Books are included based on the presence of pack/manifest.json.
 * Preview is available if pack/segments.json also exists.
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const REPO_ROOT = path.join(SCRIPT_DIR, '..', '..');
const BOOKS_DIR = path.join(REPO_ROOT, 'books');
const OUTPUT_DIR = path.join(REPO_ROOT, 'web', 'io', 'data');
const SEGMENTS_DIR = path.join(OUTPUT_DIR, 'segments');

// Categories we recognize under books/
const CATEGORIES = ['sports', 'history', 'religion', 'science'];

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (err) {
    console.warn(`[catalog] Failed to read ${p}: ${err.message}`);
    return null;
  }
}

/**
 * Minimal YAML parser for the top-level `voices:` block in narration.yaml.
 * We only need language codes, not the full structure.
 */
function extractNarrationLanguages(yamlPath) {
  if (!fs.existsSync(yamlPath)) return null;
  const text = fs.readFileSync(yamlPath, 'utf-8');
  const lines = text.split('\n');
  const langs = [];
  let inVoices = false;
  for (const line of lines) {
    if (/^voices:\s*$/.test(line)) {
      inVoices = true;
      continue;
    }
    if (inVoices) {
      // Leave the voices block on a line that starts at column 0 (not indented)
      if (/^\S/.test(line)) break;
      const m = line.match(/^\s{2}([a-z]{2,3}):\s*/);
      if (m) langs.push(m[1]);
    }
  }
  return langs.length ? langs : null;
}

function extractChapters(segments) {
  // Group by chapter number, take the first title seen per chapter
  const chapterMap = new Map();
  for (const seg of segments) {
    if (typeof seg.chapter !== 'number') continue;
    if (!chapterMap.has(seg.chapter)) {
      chapterMap.set(seg.chapter, {
        number: seg.chapter,
        title: seg.title || `Chapter ${seg.chapter}`,
        segmentCount: 0,
      });
    }
    chapterMap.get(seg.chapter).segmentCount += 1;
  }
  return [...chapterMap.values()].sort((a, b) => a.number - b.number);
}

function extractFirstChapter(segments, chapters) {
  if (!chapters.length) return null;
  // Use the first non-zero chapter if present (skip "A Note to the Reader" style prefaces).
  // Otherwise, use whatever the lowest chapter is.
  const candidates = chapters.filter((c) => c.number > 0);
  const target = (candidates[0] || chapters[0]).number;
  return segments.filter((s) => s.chapter === target);
}

function processBook(category, seriesSlug, seriesTitle, bookDir) {
  const packDir = path.join(bookDir, 'pack');
  const manifestPath = path.join(packDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;

  const manifest = readJson(manifestPath);
  if (!manifest || !manifest.id || !manifest.name) return null;

  const meta = manifest.metadata || {};
  const bookSlug = slugify(manifest.name);
  const segmentsPath = path.join(packDir, 'segments.json');
  const hasSegments = fs.existsSync(segmentsPath);

  let chapters = [];
  let chapterCount = 0;
  let segmentCount = 0;
  let hasPreview = false;

  if (hasSegments) {
    const data = readJson(segmentsPath);
    if (data && Array.isArray(data.segments)) {
      chapters = extractChapters(data.segments);
      chapterCount = chapters.length;
      segmentCount = data.segments.length;
      const firstChapterSegments = extractFirstChapter(data.segments, chapters);
      if (firstChapterSegments && firstChapterSegments.length > 0) {
        ensureDir(SEGMENTS_DIR);
        fs.writeFileSync(
          path.join(SEGMENTS_DIR, `${manifest.id}-ch1.json`),
          JSON.stringify(
            {
              bookId: manifest.id,
              bookTitle: manifest.name,
              chapter: firstChapterSegments[0].chapter,
              chapterTitle: firstChapterSegments[0].title,
              segments: firstChapterSegments,
            },
            null,
            0
          )
        );
        hasPreview = true;
      }
    }
  }

  // Narration languages — prefer narration.yaml, fall back to primary_language, then ["en"].
  let narrationLanguages = extractNarrationLanguages(
    path.join(packDir, 'narration.yaml')
  );
  if (!narrationLanguages) {
    narrationLanguages = manifest.primary_language
      ? [manifest.primary_language]
      : ['en'];
  }

  return {
    slug: bookSlug,
    id: manifest.id,
    title: manifest.name,
    author: meta.author || 'Corpora',
    series: meta.series || seriesTitle,
    volume: typeof meta.volume === 'number' ? meta.volume : null,
    estimatedReadTime: meta.estimatedReadTime || null,
    estimatedListenTime: meta.estimatedListenTime || null,
    primaryLanguage: manifest.primary_language || 'en',
    chapterCount,
    segmentCount,
    hasPreview,
    narrationLanguages,
    chapters,
    // Internal-only: path info used to locate assets if needed later
    _sourceDir: path.relative(REPO_ROOT, bookDir),
  };
}

function discoverSeries(category) {
  const categoryDir = path.join(BOOKS_DIR, category);
  if (!fs.existsSync(categoryDir)) return [];
  const entries = fs
    .readdirSync(categoryDir, { withFileTypes: true })
    .filter((e) => e.isDirectory());

  return entries.map((entry) => {
    const seriesDir = path.join(categoryDir, entry.name);
    const seriesSlug = entry.name; // e.g. "u10-7v7-soccer"

    // Scan children for books that have pack/manifest.json
    const children = fs
      .readdirSync(seriesDir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => path.join(seriesDir, e.name))
      .sort();

    const books = [];
    let seriesTitle = null;

    for (const bookDir of children) {
      // Peek at manifest to derive series title
      const manifestPath = path.join(bookDir, 'pack', 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = readJson(manifestPath);
      if (!manifest) continue;
      if (!seriesTitle && manifest.metadata && manifest.metadata.series) {
        seriesTitle = manifest.metadata.series;
      }
      const book = processBook(
        category,
        seriesSlug,
        seriesTitle || entry.name,
        bookDir
      );
      if (book) books.push(book);
    }

    if (books.length === 0) return null;

    // Sort by volume if available, otherwise leave directory order
    books.sort((a, b) => {
      if (a.volume != null && b.volume != null) return a.volume - b.volume;
      return 0;
    });

    return {
      slug: seriesSlug,
      title: seriesTitle || entry.name,
      category,
      bookCount: books.length,
      books,
    };
  });
}

function main() {
  console.log('[catalog] Scanning books/...');
  ensureDir(OUTPUT_DIR);

  // Clear old segment files so deleted books don't linger
  if (fs.existsSync(SEGMENTS_DIR)) {
    for (const f of fs.readdirSync(SEGMENTS_DIR)) {
      if (f.endsWith('.json')) {
        fs.unlinkSync(path.join(SEGMENTS_DIR, f));
      }
    }
  }

  const series = [];
  for (const category of CATEGORIES) {
    const found = discoverSeries(category).filter(Boolean);
    series.push(...found);
  }

  const catalog = {
    generatedAt: new Date().toISOString(),
    series,
  };

  const outPath = path.join(OUTPUT_DIR, 'book-catalog.json');
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2));

  const totalBooks = series.reduce((sum, s) => sum + s.bookCount, 0);
  const totalPreviews = series.reduce(
    (sum, s) => sum + s.books.filter((b) => b.hasPreview).length,
    0
  );
  console.log(
    `[catalog] Wrote ${outPath} — ${series.length} series, ${totalBooks} books, ${totalPreviews} with preview`
  );
}

main();
