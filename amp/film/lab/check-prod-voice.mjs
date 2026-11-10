/** Offline fixtures for the production take loop, including request shape. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = process.argv[2];
const { goodTake, takeKey } = await import(pathToFileURL(join(directory, 'voice.ts')).href);
const voice = { id: 'SYXbTJsLE7zmSjr1DchT', tag: '[energetic]' };
const text = 'Hello.';
const key = takeKey(voice, text);
const heard = (words = text) => ({ text: words, words: [{ text: words, start: 0, end: .48, type: 'word' }] });
function take(clipped) {
  const pcm = new Int16Array(44100);
  pcm.fill(1000, 0, clipped ? pcm.length : 22050);
  return { audio: Buffer.from(pcm.buffer).toString('base64'), alignment: {
    characters: ['H', 'e', 'l', 'l', 'o', '.'],
    character_start_times_seconds: [0, .08, .16, .24, .32, .40],
    character_end_times_seconds: [.08, .16, .24, .32, .40, .48],
  } };
}
function fixture(name, clipped = true, mismatch = false) {
  const base = join(directory, name), shared = join(base, 'shared'), repairs = join(base, 'repairs');
  mkdirSync(shared, { recursive: true });
  mkdirSync(repairs);
  for (let k = 0; k < 3; k++) {
    const stem = join(shared, key+(k ? '.'+k : ''));
    writeFileSync(stem+'.json', JSON.stringify(take(clipped)));
    writeFileSync(stem+'.heard.json', JSON.stringify(heard(mismatch && k < 2 ? 'Yellow.' : text)));
  }
  process.env.FILM_PROD_VOICE_REPAIR_CACHE = repairs;
  return { shared, repairs };
}
const contents = path => Object.fromEntries(readdirSync(path).sort().map(name => [name, readFileSync(join(path, name), 'utf8')]));
delete process.env.FILM_NO_VOICE;
process.env.ELEVEN_LABS_API_KEY = 'offline-fixture-key';
let calls = 0;
globalThis.fetch = async (url, options) => {
  calls++;
  if (String(url).includes('/text-to-speech/')) {
    assert.ok(String(url).includes(voice.id));
    const request = JSON.parse(options.body);
    assert.equal(request.text, '[energetic] Hello.');
    assert.equal(request.seed, 1003);
    assert.equal(request.previous_text, undefined);
    assert.equal(request.next_text, undefined);
    const clean = take(false);
    return new Response(JSON.stringify({ audio_base64: clean.audio, alignment: clean.alignment }), { status: 200 });
  }
  assert.ok(String(url).endsWith('/speech-to-text'));
  return new Response(JSON.stringify(heard()), { status: 200 });
};
const success = fixture('success');
const before = contents(success.shared);
const repaired = await goodTake(success.shared, text, 'Previous sentence.', 'Next sentence.', voice);
assert.deepEqual(repaired.faults, []);
assert.equal(repaired.spent, text.length);
assert.equal(calls, 2, 'one repaired generation and its transcription');
assert.deepEqual(contents(success.shared), before, 'repair must not promote into or replace the original cache');
const receipt = JSON.parse(readFileSync(join(success.repairs, key+'.3.repair.json'), 'utf8'));
assert.equal(receipt.seed, 1003);
assert.equal(receipt.voice, voice.id);
assert.deepEqual(receipt.faults, []);
globalThis.fetch = async () => { throw new Error('No further request is allowed'); };
const cached = await goodTake(success.shared, text, 'Different context.', undefined, voice);
assert.deepEqual(cached.faults, []);
assert.equal(cached.spent, 0);

const failed = fixture('six-clipped');
const beforeFailed = contents(failed.shared);
for (let k = 3; k < 6; k++) {
  const stem = join(failed.repairs, key+'.'+k);
  writeFileSync(stem+'.json', JSON.stringify(take(true)));
  writeFileSync(stem+'.heard.json', JSON.stringify(heard()));
}
await assert.rejects(goodTake(failed.shared, text, undefined, undefined, voice), /Six takes failed/);
assert.deepEqual(contents(failed.shared), beforeFailed);

const mismatched = fixture('mismatch', false, true);
const mismatch = await goodTake(mismatched.shared, text, undefined, undefined, voice);
assert.ok(mismatch.faults.some(fault => fault.includes('the script says')));
assert.equal(mismatch.spent, 0);
assert.equal(readdirSync(mismatched.repairs).length, 0, 'repeated transcript mismatches must not buy repairs');
const mixed = fixture('mixed-faults', true, true);
await assert.rejects(goodTake(mixed.shared, text, undefined, undefined, voice), /No acoustically valid take/);
assert.equal(readdirSync(mixed.repairs).length, 0);
process.stdout.write('Production acoustic repair, cache preservation, strict exhaustion and transcript boundaries passed offline.\n');
