/** Offline integration fixture for the instrumented kit's actual take loop. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const directory = process.argv[2];
globalThis.fetch = async () => { throw new Error('This fixture must make no network calls'); };
const { goodTake, takeKey, VOICE_ID } = await import(pathToFileURL(join(directory, 'voice.ts')).href);
const voice = { id: VOICE_ID };
const text = 'Hello.';
const key = takeKey(voice, text);

function fixture(name, truncated) {
  const folder = join(directory, name);
  mkdirSync(folder);
  for (let index = 0; index < 3; index++) {
    const pcm = new Int16Array(44100);
    pcm.fill(1000, 0, truncated && index < 2 ? pcm.length : 22050);
    const take = { audio: Buffer.from(pcm.buffer).toString('base64'), alignment: {
      characters: ['H', 'e', 'l', 'l', 'o', '.'],
      character_start_times_seconds: [0, .08, .16, .24, .32, .40],
      character_end_times_seconds: [.08, .16, .24, .32, .40, .48],
    } };
    const heard = !truncated && index < 2 ? 'Yellow.' : text;
    const stem = join(folder, key+(index ? '.'+index : ''));
    writeFileSync(stem+'.json', JSON.stringify(take));
    writeFileSync(stem+'.heard.json', JSON.stringify({ text: heard,
      words: [{ text: heard, start: 0, end: .48, type: 'word' }] }));
  }
  return folder;
}

const repaired = await goodTake(fixture('truncated', true), text, undefined, undefined, voice);
assert.deepEqual(repaired.faults, [], 'the third clean take must be considered after two clipped endings');
assert.equal(repaired.spent, 0);
const mismatch = await goodTake(fixture('mismatch', false), text, undefined, undefined, voice);
assert.ok(mismatch.faults.some(fault => fault.includes('the script says')),
  'a repeated transcript mismatch must still stop before the third take');
assert.equal(mismatch.spent, 0);
process.stdout.write('Acoustic retry and repeated-word early stop passed with cached fixtures.\n');
