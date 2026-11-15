/** Notify participating search engines only of changed or removed public URLs. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const origin = 'https://corpora.inc';
const bucket = process.env.WORKBOOK_BUCKET;
assert(bucket && /^[a-z0-9.-]+$/.test(bucket), 'WORKBOOK_BUCKET is required');
const stateKey = 'artifacts/amp/public-site/discovery/indexnow-state.json';
const work = mkdtempSync(join(tmpdir(), 'amp-indexnow-'));
const aws = args => {
  try { return execFileSync('aws', ['s3api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 }); }
  catch { throw new Error(`Discovery storage ${args[0]} failed`); }
};
const get = async url => {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
  assert(response.ok, `Cannot fetch public discovery file (${response.status})`);
  return response;
};
const validate = state => {
  assert.equal(state.origin, origin);
  assert(Array.isArray(state.documents) && state.documents.length > 0 && state.documents.length < 10_000);
  for (const document of state.documents) {
    const url = new URL(document.url);
    assert(url.origin === origin && !url.search && !url.hash && /^[a-f0-9]{64}$/.test(document.sha256));
  }
  assert.equal(new Set(state.documents.map(d => d.url)).size, state.documents.length);
  return state;
};
try {
  const current = validate(await (await get(`${origin}/search-index.json`)).json());
  assert(current.keyLocation && new URL(current.keyLocation).origin === origin, 'IndexNow key is not configured');
  const key = (await (await get(current.keyLocation)).text()).trim();
  assert(/^[A-Za-z0-9-]{8,128}$/.test(key) && current.keyLocation === `${origin}/${key}.txt`, 'Invalid public IndexNow key');
  let previous = [];
  try {
    const file = join(work, 'previous.json');
    aws(['get-object', '--bucket', bucket, '--key', stateKey, file]);
    previous = validate(JSON.parse(readFileSync(file, 'utf8'))).documents;
  } catch { console.log('No prior submission receipt; submitting the public catalog.'); }
  const oldHashes = new Map(previous.map(d => [d.url, d.sha256]));
  const newUrls = new Set(current.documents.map(d => d.url));
  const changed = current.documents.filter(d => oldHashes.get(d.url) !== d.sha256).map(d => d.url);
  const removed = previous.filter(d => !newUrls.has(d.url)).map(d => d.url);
  const urlList = [...new Set([...changed, ...removed])];
  if (!urlList.length) {
    console.log('No changed public URLs to submit.');
  } else {
    assert(urlList.length <= 10_000);
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: 'corpora.inc', key, keyLocation: current.keyLocation, urlList }),
      signal: AbortSignal.timeout(60_000),
    });
    assert([200, 202].includes(response.status), `IndexNow rejected the submission (${response.status})`);
    const receipt = { ...current, submittedAt: new Date().toISOString(), status: response.status, submittedUrls: urlList };
    const file = join(work, 'receipt.json');
    writeFileSync(file, JSON.stringify(receipt, null, 2) + '\n');
    aws(['put-object', '--bucket', bucket, '--key', stateKey, '--body', file, '--content-type', 'application/json', '--cache-control', 'no-cache']);
    console.log(`IndexNow accepted ${urlList.length} changed/removed URLs (HTTP ${response.status}). This is a submission receipt, not an indexing guarantee.`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      const { appendFileSync } = await import('node:fs');
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `IndexNow accepted ${urlList.length} changed/removed public URLs (HTTP ${response.status}).\n`);
    }
  }
} finally { rmSync(work, { recursive: true, force: true }); }
