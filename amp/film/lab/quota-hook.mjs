/** Import only in the authorized voice process. Guard every take, including retries. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const RESERVE = 50_000;
const VOICES = new Set(['XescS24CsOySAkKrLAO3', 'J3Ei0Lj6fAobhIqY5ySH', 'SYXbTJsLE7zmSjr1DchT']);

export function remainingBudget(state, liveRemaining) {
  if (!Number.isFinite(liveRemaining) || liveRemaining < 0) throw new Error('Invalid voice quota');
  if (!Number.isFinite(state.initial_remaining) || !Number.isFinite(state.reserved_characters))
    throw new Error('Invalid voice quota ledger');
  return Math.min(liveRemaining, state.initial_remaining - state.reserved_characters);
}

export function canReserve(state, liveRemaining, characters) {
  if (!Number.isSafeInteger(characters) || characters < 1) throw new Error('Invalid character count');
  if (state.reserve_stopped) return false;
  return remainingBudget(state, liveRemaining) - characters >= RESERVE;
}

const statePath = process.env.FILM_LAB_QUOTA_STATE;
if (statePath) {
  const lock = join(dirname(statePath), 'voice-owner.lock');
  mkdirSync(dirname(statePath), { recursive: true });
  try {
    mkdirSync(lock);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8'));
    let active = true;
    try { process.kill(owner.pid, 0); }
    catch (failure) { if (failure.code === 'ESRCH') active = false; else throw failure; }
    if (active) throw new Error('Another voice process owns the quota ledger');
    execFileSync('trash', [lock], { stdio: 'ignore' });
    mkdirSync(lock);
  }
  writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, film: process.env.FILM_LAB_ID }));
  process.on('exit', () => {
    try {
      if (JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8')).pid === process.pid)
        execFileSync('trash', [lock], { stdio: 'ignore' });
    } catch { /* A stale lock is reconciled by its recorded owner PID next time. */ }
  });
  const nativeFetch = globalThis.fetch;
  const ledgerPath = process.env.FILM_LAB_VOICE_LEDGER;
  if (!ledgerPath) throw new Error('FILM_LAB_VOICE_LEDGER is required with the quota guard');
  let chain = Promise.resolve();
  let modelVerified = false;
  const event = (value) => {
    mkdirSync(dirname(ledgerPath), { recursive: true });
    appendFileSync(ledgerPath, JSON.stringify({ at: new Date().toISOString(), film: process.env.FILM_LAB_ID, ...value })+'\n');
  };
  const save = (state) => {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath+'.tmp', JSON.stringify(state, null, 2)+'\n');
    renameSync(statePath+'.tmp', statePath);
  };
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== 'https://api.elevenlabs.io' || !url.pathname.startsWith('/v1/text-to-speech/'))
      return nativeFetch(input, init);
    const job = chain.then(async () => {
      const voice = url.pathname.split('/')[3];
      if (!VOICES.has(voice)) throw new Error('Voice is not approved for the experiment');
      if (typeof init?.body !== 'string') throw new Error('Cannot inspect the voice request');
      const body = JSON.parse(init.body);
      if (body.model_id !== 'eleven_v4' || typeof body.text !== 'string')
        throw new Error('Unexpected voice model or text');
      const headers = new Headers(init.headers);
      const key = headers.get('xi-api-key');
      if (!key) throw new Error('Voice API credential missing');
      if (!modelVerified) {
        const response = await nativeFetch('https://api.elevenlabs.io/v1/models', { headers: { 'xi-api-key': key } });
        if (!response.ok) throw new Error(`Cannot verify voice model: HTTP ${response.status}`);
        const models = await response.json();
        const model = models.find(m => m.model_id === 'eleven_v4');
        if (!model?.can_do_text_to_speech || model.token_cost_factor !== 1)
          throw new Error('Voice credit factor differs from the verified one-character rate');
        modelVerified = true;
      }
      const response = await nativeFetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } });
      if (!response.ok) throw new Error(`Cannot read voice quota: HTTP ${response.status}`);
      const quota = await response.json();
      const liveRemaining = quota.character_limit - quota.character_count;
      const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {
        initial_remaining: liveRemaining, reserved_characters: 0, confirmed_characters: 0,
        started_at: new Date().toISOString(), reserve: RESERVE,
      };
      const characters = body.text.length;
      if (!canReserve(state, liveRemaining, characters)) {
        state.reserve_stopped = true;
        state.stop_film ??= process.env.FILM_LAB_ID;
        state.stopped_at ??= new Date().toISOString();
        save(state);
        event({ kind: 'reserve-stop', voice, requested_characters: characters,
                remaining: remainingBudget(state, liveRemaining), reserve: RESERVE });
        throw new Error('VOICE_RESERVE: this take would breach the 50,000-character reserve');
      }
      const id = randomUUID();
      state.reserved_characters += characters;
      state.last_live_remaining = liveRemaining;
      save(state);
      event({ kind: 'reserved', request_id: id, voice, characters,
              text_sha256: createHash('sha256').update(body.text).digest('hex'),
              live_remaining_before: liveRemaining });
      try {
        const result = await nativeFetch(input, init);
        const reported = result.headers.get('character-cost');
        const charged = reported !== null && Number.isFinite(Number(reported)) ? Number(reported) : characters;
        if (result.ok) {
          state.confirmed_characters += charged;
          state.reserved_characters += Math.max(0, charged-characters);
          save(state);
        }
        event({ kind: result.ok ? 'succeeded' : 'http-failure', request_id: id, voice,
                status: result.status, characters, reported_character_cost: reported,
                charged_characters: result.ok ? charged : null,
                charge_basis: reported === null ? 'request text at verified factor 1' : 'provider response header' });
        return result;
      } catch (error) {
        // A lost response may have been billed. Preserve its reservation.
        event({ kind: 'unknown-charge', request_id: id, voice, characters, error_type: error?.name });
        throw error;
      }
    });
    chain = job.then(() => undefined, () => undefined);
    return job;
  };
}
