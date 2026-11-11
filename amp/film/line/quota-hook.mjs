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

export function snapshotRemaining(snapshot, state) {
  return snapshot.remaining - Math.max(0, state.reserved_characters - snapshot.reserved_at_read);
}

export function transcriptionReservation(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600)
    throw new Error('Invalid transcription duration');
  // A conservative temporary hold, not a billing rate. It exceeds the
  // published Scribe free/UI allowance of 10,000 credits per 12 minutes.
  // https://elevenlabs.io/speech-to-text (checked 2026-11-10).
  return Math.ceil(seconds * 20);
}

export function reconcileConfirmedDiscounts(state, events) {
  const seen = new Set();
  let discounts = 0;
  for (const entry of events) {
    if (entry.kind !== 'succeeded' || seen.has(entry.request_id)) continue;
    if (!Number.isSafeInteger(entry.characters) || !Number.isSafeInteger(entry.charged_characters)
        || entry.charged_characters < 0) throw new Error('Invalid confirmed voice charge');
    seen.add(entry.request_id);
    discounts += Math.max(0, entry.characters - entry.charged_characters);
  }
  const released = state.released_characters ?? 0;
  const additional = Math.max(0, discounts - released);
  if (state.reserved_characters - additional < state.confirmed_characters)
    throw new Error('Voice charge reconciliation would release confirmed spending');
  return { ...state, reserved_characters: state.reserved_characters - additional,
    released_characters: released + additional };
}

export async function readQuotaWithBackoff(fetcher, key, onRetry, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetcher('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } });
    if (response.ok) return response.json();
    if ((response.status !== 429 && response.status < 500) || attempt === 4)
      throw new Error(`Cannot read voice quota: HTTP ${response.status}`);
    const retry = response.headers.get('retry-after');
    const requested = retry === null ? 0 : Number.isFinite(Number(retry))
      ? Number(retry)*1000 : Math.max(0, Date.parse(retry)-Date.now());
    const delay = Math.max(Math.min(30_000*2**attempt, 60_000), Number.isFinite(requested) ? requested : 0);
    if (delay > 300_000) throw new Error('Voice quota Retry-After exceeds five minutes');
    await response.body?.cancel();
    onRetry({ kind: 'quota-read-retry', status: response.status, attempt: attempt+1, wait_ms: delay });
    await sleep(delay);
  }
}

const statePath = process.env.FILM_LINE_QUOTA_STATE;
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
  writeFileSync(join(lock, 'owner.json'), JSON.stringify({ pid: process.pid, film: process.env.FILM_LINE_ID }));
  process.on('exit', () => {
    try {
      if (JSON.parse(readFileSync(join(lock, 'owner.json'), 'utf8')).pid === process.pid)
        execFileSync('trash', [lock], { stdio: 'ignore' });
    } catch { /* A stale lock is reconciled by its recorded owner PID next time. */ }
  });
  const nativeFetch = globalThis.fetch;
  const ledgerPath = process.env.FILM_LINE_VOICE_LEDGER;
  if (!ledgerPath) throw new Error('FILM_LINE_VOICE_LEDGER is required with the quota guard');
  let chain = Promise.resolve();
  let modelVerified = false;
  let quotaSnapshot = null;
  const event = (value) => {
    mkdirSync(dirname(ledgerPath), { recursive: true });
    appendFileSync(ledgerPath, JSON.stringify({ at: new Date().toISOString(), film: process.env.FILM_LINE_ID, ...value })+'\n');
  };
  const save = (state) => {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileSync(statePath+'.tmp', JSON.stringify(state, null, 2)+'\n');
    renameSync(statePath+'.tmp', statePath);
  };
  // A provider-confirmed discount can release its unused reservation. Failed
  // requests and lost responses retain their entire reservation. Reconcile
  // receipts from earlier processes while holding the sole voice-owner lock.
  if (existsSync(statePath) && existsSync(ledgerPath)) {
    const entries = readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    save(reconcileConfirmedDiscounts(JSON.parse(readFileSync(statePath, 'utf8')), entries));
  }
  globalThis.fetch = (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const tts = url.pathname.startsWith('/v1/text-to-speech/');
    const stt = url.pathname === '/v1/speech-to-text';
    if (url.origin !== 'https://api.elevenlabs.io' || (!tts && !stt))
      return nativeFetch(input, init);
    const job = chain.then(async () => {
      const voice = tts ? url.pathname.split('/')[3] : null;
      let characters, metadata;
      if (tts) {
        if (!VOICES.has(voice)) throw new Error('Voice is not approved for production');
        if (typeof init?.body !== 'string') throw new Error('Cannot inspect the voice request');
        const body = JSON.parse(init.body);
        if (body.model_id !== 'eleven_v4' || typeof body.text !== 'string')
          throw new Error('Unexpected voice model or text');
        characters = body.text.length;
        metadata = { operation: 'tts', model: body.model_id, input_characters: characters,
          text_sha256: createHash('sha256').update(body.text).digest('hex') };
      } else {
        if (!(init?.body instanceof FormData) || init.body.get('model_id') !== 'scribe_v2')
          throw new Error('Unexpected transcription request');
        const file = init.body.get('file');
        if (!(file instanceof Blob)) throw new Error('Transcription needs the kit WAV file');
        const wav = Buffer.from(await file.arrayBuffer());
        if (wav.length < 44 || wav.toString('ascii', 0, 4) !== 'RIFF'
            || wav.toString('ascii', 8, 12) !== 'WAVE' || wav.toString('ascii', 36, 40) !== 'data'
            || wav.readUInt16LE(20) !== 1 || wav.readUInt32LE(28) !== 88200)
          throw new Error('Transcription input is not the kit PCM format');
        const seconds = (wav.length - 44) / 88200;
        characters = transcriptionReservation(seconds);
        metadata = { operation: 'stt', model: 'scribe_v2', audio_seconds: seconds,
          audio_sha256: createHash('sha256').update(wav).digest('hex'),
          reservation_basis: 'temporary upper hold of 20 quota credits per audio second; not a price' };
      }
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
      let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
      if (!quotaSnapshot || Date.now()-quotaSnapshot.checked_at >= 30_000
          || (state && snapshotRemaining(quotaSnapshot, state) < RESERVE+5_000)) {
        const quota = await readQuotaWithBackoff(nativeFetch, key, event);
        quotaSnapshot = { remaining: quota.character_limit-quota.character_count,
          reserved_at_read: state?.reserved_characters ?? 0, checked_at: Date.now() };
        event({ kind: 'quota-read', remaining: quotaSnapshot.remaining });
      }
      state ??= {
        initial_remaining: quotaSnapshot.remaining, reserved_characters: 0, confirmed_characters: 0,
        started_at: new Date().toISOString(), reserve: RESERVE,
      };
      const liveRemaining = snapshotRemaining(quotaSnapshot, state);
      if (!canReserve(state, liveRemaining, characters)) {
        state.reserve_stopped = true;
        state.stop_film ??= process.env.FILM_LINE_ID;
        state.stopped_at ??= new Date().toISOString();
        save(state);
        event({ kind: 'reserve-stop', voice, ...metadata, requested_characters: characters,
                remaining: remainingBudget(state, liveRemaining), reserve: RESERVE });
        throw new Error('VOICE_RESERVE: this take would breach the 50,000-character reserve');
      }
      const id = randomUUID();
      state.reserved_characters += characters;
      state.last_live_remaining = liveRemaining;
      save(state);
      event({ kind: 'reserved', request_id: id, voice, characters, ...metadata,
              live_remaining_before: liveRemaining, quota_age_ms: Date.now()-quotaSnapshot.checked_at });
      try {
        const result = await nativeFetch(input, init);
        const reported = result.headers.get('character-cost');
        const charged = reported !== null && Number.isSafeInteger(Number(reported)) && Number(reported) >= 0
          ? Number(reported) : tts ? characters : null;
        if (result.ok && charged !== null) {
          state.confirmed_characters += charged;
          state.reserved_characters += charged-characters;
          state.released_characters = (state.released_characters ?? 0)+Math.max(0, characters-charged);
          save(state);
        }
        event({ kind: result.ok ? charged === null ? 'unmetered-success' : 'succeeded' : 'http-failure',
                request_id: id, voice, ...metadata,
                status: result.status, characters, reported_character_cost: reported,
                charged_characters: result.ok ? charged : null,
                charge_basis: reported === null ? tts ? 'request text at verified factor 1' : 'unknown; reservation retained' : 'provider response header' });
        return result;
      } catch (error) {
        // A lost response may have been billed. Preserve its reservation.
        event({ kind: 'unknown-charge', request_id: id, voice, characters, ...metadata, error_type: error?.name });
        throw error;
      }
    });
    chain = job.then(() => undefined, () => undefined);
    return job;
  };
}
