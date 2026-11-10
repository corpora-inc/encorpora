import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canReserve, remainingBudget, reconcileConfirmedDiscounts, readQuotaWithBackoff,
  snapshotRemaining, transcriptionReservation } from './quota-hook.mjs';

test('the last permitted character leaves the full reserve', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0 };
  assert.equal(canReserve(state, 60_000, 10_000), true);
  assert.equal(canReserve(state, 60_000, 10_001), false);
});
test('a delayed provider counter cannot release locally reserved characters', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 8_000 };
  assert.equal(remainingBudget(state, 60_000), 52_000);
  assert.equal(canReserve(state, 60_000, 2_001), false);
});
test('spending by another producer is reflected in the live quota', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0 };
  assert.equal(canReserve(state, 50_100, 101), false);
});
test('unknown quota and invalid requests fail closed', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0 };
  assert.throws(() => canReserve(state, NaN, 1));
  assert.throws(() => canReserve(state, 60_000, -1));
  assert.throws(() => canReserve({}, 60_000, 1));
});
test('a reserve stop also stops later smaller takes', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 0, reserve_stopped: true };
  assert.equal(canReserve(state, 60_000, 1), false);
});
test('confirmed discounts release only known unused reservations and resume once', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 300, confirmed_characters: 100 };
  const success = { kind: 'succeeded', request_id: 'one', characters: 200, charged_characters: 100 };
  const events = [success, success, { kind: 'unknown-charge', request_id: 'two', characters: 100 }];
  const reconciled = reconcileConfirmedDiscounts(state, events);
  assert.equal(reconciled.reserved_characters, 200);
  assert.equal(reconciled.confirmed_characters, 100);
  assert.equal(reconciled.released_characters, 100);
  assert.deepEqual(reconcileConfirmedDiscounts(reconciled, events), reconciled);
  assert.equal(remainingBudget(reconciled, 60_000), 59_800);
});
test('reconciliation preserves state written before a success receipt and rejects impossible release', () => {
  const state = { initial_remaining: 60_000, reserved_characters: 100,
    confirmed_characters: 100, released_characters: 100 };
  assert.deepEqual(reconcileConfirmedDiscounts(state, []), state);
  assert.throws(() => reconcileConfirmedDiscounts({ ...state, released_characters: 0 },
    [{ kind: 'succeeded', request_id: 'one', characters: 200, charged_characters: 100 }]));
});
test('a quota rate limit waits for Retry-After before retrying the read-only request', async () => {
  const responses = [new Response('', { status: 429, headers: { 'retry-after': '45' } }),
    Response.json({ character_limit: 60_000, character_count: 10 })];
  const waits = [], events = [];
  const quota = await readQuotaWithBackoff(async () => responses.shift(), 'test-placeholder',
    value => events.push(value), async value => waits.push(value));
  assert.deepEqual(waits, [45_000]);
  assert.equal(events[0].status, 429);
  assert.equal(quota.character_count, 10);
});
test('quota read retries are bounded and authentication failures are not retried', async () => {
  let calls = 0;
  await assert.rejects(readQuotaWithBackoff(async () => { calls++; return new Response('', { status: 429 }); },
    'test-placeholder', () => {}, async () => {}), /HTTP 429/);
  assert.equal(calls, 5);
  calls = 0;
  await assert.rejects(readQuotaWithBackoff(async () => { calls++; return new Response('', { status: 401 }); },
    'test-placeholder', () => {}, async () => {}), /HTTP 401/);
  assert.equal(calls, 1);
});
test('cached quota subtracts local spending since its read without releasing unknown charges', () => {
  const snapshot = { remaining: 51_000, reserved_at_read: 10_000 };
  assert.equal(snapshotRemaining(snapshot, { reserved_characters: 10_700 }), 50_300);
  assert.equal(snapshotRemaining(snapshot, { reserved_characters: 9_000 }), 51_000);
});
test('transcription holds are bounded from the measured audio duration', () => {
  assert.equal(transcriptionReservation(3.25), 65);
  assert.equal(transcriptionReservation(3.251), 66);
  assert.throws(() => transcriptionReservation(NaN));
  assert.throws(() => transcriptionReservation(0));
  assert.throws(() => transcriptionReservation(3601));
});
test('the fetch hook guards synthesis and transcription without polling quota for every call', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'film-quota-'));
  const statePath = join(directory, 'quota.json'), ledgerPath = join(directory, 'ledger.jsonl');
  const names = ['FILM_LAB_QUOTA_STATE', 'FILM_LAB_VOICE_LEDGER', 'FILM_LAB_ID'];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const original = globalThis.fetch;
  let quotaReads = 0, syntheses = 0, transcriptions = 0;
  try {
    process.env.FILM_LAB_QUOTA_STATE = statePath;
    process.env.FILM_LAB_VOICE_LEDGER = ledgerPath;
    process.env.FILM_LAB_ID = 'test--aa';
    globalThis.fetch = async input => {
      const url = String(input);
      if (url.endsWith('/models')) return Response.json([{ model_id: 'eleven_v4', can_do_text_to_speech: true, token_cost_factor: 1 }]);
      if (url.endsWith('/subscription')) { quotaReads++; return Response.json({ character_limit: 60_000, character_count: 0 }); }
      if (url.includes('/text-to-speech/')) { syntheses++; return Response.json({}, { headers: { 'character-cost': '50' } }); }
      if (url.endsWith('/speech-to-text')) {
        transcriptions++;
        return Response.json({}, { headers: transcriptions === 1 ? { 'character-cost': '2' } : {} });
      }
      throw new Error('Unexpected test request');
    };
    await import('./quota-hook.mjs?fetch-integration');
    const headers = { 'xi-api-key': 'test-placeholder' };
    const tts = text => fetch('https://api.elevenlabs.io/v1/text-to-speech/XescS24CsOySAkKrLAO3/with-timestamps',
      { method: 'POST', headers, body: JSON.stringify({ model_id: 'eleven_v4', text }) });
    await tts('a'.repeat(100));
    const wav = Buffer.alloc(44+3*88200);
    wav.write('RIFF'); wav.write('WAVE', 8); wav.writeUInt16LE(1, 20);
    wav.writeUInt32LE(88200, 28); wav.write('data', 36);
    const form = new FormData();
    form.set('model_id', 'scribe_v2');
    form.set('file', new Blob([wav], { type: 'audio/wav' }), 'take.wav');
    await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers, body: form });
    let state = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(state.confirmed_characters, 52);
    assert.equal(state.reserved_characters, 52);
    await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers, body: form });
    state = JSON.parse(readFileSync(statePath, 'utf8'));
    assert.equal(state.reserved_characters, 112); // Unknown transcription charge stays held.
    await assert.rejects(tts('a'.repeat(9990)), /VOICE_RESERVE/);
    assert.equal(quotaReads, 1);
    assert.equal(syntheses, 1);
    assert.equal(transcriptions, 2);
  } finally {
    globalThis.fetch = original;
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    }
    rmSync(directory, { recursive: true });
  }
});
