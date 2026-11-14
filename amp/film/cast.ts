/**
 * The cast: who speaks each beat, and which voice says it.
 *
 * A lesson may name speakers (open keys, each a role kind) and give each beat
 * a speaker key. A lesson without a cast is read by the narrator. Voices are
 * chosen when the film is made: `--voice speaker=voice` re-voices one speaker
 * without touching the screenplay, and `--out` keeps another edition. The same
 * voice is never given to two speakers of one film. Everything here is pure
 * (and free of node modules, so the stage can import it in the browser).
 */
import type { Script } from "./schema";
import { respellingKey, voiceText } from "./letters";
import { isRoleKind, NARRATOR_ID, VOICES, voicesFor, type RoleKind, type VoiceSpec } from "./voices";

export { NARRATOR_ID };
export const MODEL = "eleven_v4";
/** Silence between two speakers' turns: a breath, like a real exchange. */
export const TURN_GAP = 0.5;

/** Derived from `voices.ts` so older callers can look a voice up by id. */
export const APPROVED: Record<string, { short: string; name: string; roles: RoleKind[]; tag?: string }> =
  Object.fromEntries(VOICES.map((voice) => [voice.id, {
    short: voice.short,
    name: voice.name,
    roles: [...voice.kinds],
    ...(voice.tag ? { tag: voice.tag } : {}),
  }]));

export type Voice = { id: string; tag?: string };
/** `role` is the speaker key. `kind` is teacher, learner, narrator, or a later kind. `voice` is absent when no distinct approved voice is left. */
export type Role = { role: string; kind: RoleKind; name: string; voice?: Voice };
export type Cast = { roles: Role[]; named: boolean };

/** A voice by id or short name from `registry`; throws when it is not there. */
export function approvedVoice(v: string, where: string, registry: readonly VoiceSpec[] = VOICES): string {
  const byId = registry.find((voice) => voice.id === v);
  if (byId) return byId.id;
  const byShort = registry.find((voice) => voice.short === v.toLowerCase());
  if (byShort) return byShort.id;
  throw new Error(`${where}: "${v}" is not an approved voice. Use one of: ${registry.map((voice) => `${voice.short} (${voice.id})`).join(", ")}.`);
}

/** FNV-1a over the film ID gives a stable choice independent of catalog order. */
export function defaultVoice(kind: RoleKind, filmId: string, registry: readonly VoiceSpec[] = VOICES): string {
  if (kind === "narrator") return NARRATOR_ID;
  const eligible = voicesFor(kind, registry);
  if (!eligible.length) throw new Error(`No approved voices for ${kind}`);
  // The first learner voice stays Champ, so a one-learner film is unchanged
  // when another learner voice is added. Teachers are balanced across films.
  if (kind !== "teacher") return eligible[0]!.id;
  let hash = 2166136261;
  for (const char of filmId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return eligible[hash % eligible.length]!.id;
}

/** The next eligible voice for this kind that this film has not used yet, or none. */
function distinctVoice(kind: RoleKind, filmId: string, used: ReadonlySet<string>, registry: readonly VoiceSpec[]): string | undefined {
  const eligible = voicesFor(kind, registry);
  if (!eligible.length) return undefined;
  const preferred = defaultVoice(kind, filmId, registry);
  const start = Math.max(0, eligible.findIndex((voice) => voice.id === preferred));
  for (let i = 0; i < eligible.length; i++) {
    const id = eligible[(start + i) % eligible.length]!.id;
    if (!used.has(id)) return id;
  }
  return undefined;
}

type SpeakerDecl = { key: string; kind: RoleKind };

function speakersOf(script: Pick<Script, "cast">): SpeakerDecl[] {
  const cast = script.cast;
  if (!cast || !Object.keys(cast).length) return [{ key: "narrator", kind: "narrator" }];
  return Object.entries(cast).map(([key, entry]) => {
    const kind = entry.kind ?? (isRoleKind(key) ? key : undefined);
    if (!kind) throw new Error(`cast.${key} needs a role kind`);
    return { key, kind };
  });
}

/**
 * The speakers of a script, in cast order, each with its voice.
 * `overrides` (speaker key → voice id or short name) re-voice this run.
 * `registry` defaults to the approved voices. A test passes its own list.
 * A script without a cast has the single speaker `narrator`.
 * A speaker with no distinct voice left is unbound. Voicing rejects that. A dry check does not.
 */
export function resolveCast(script: Pick<Script, "id" | "cast" | "shots">, overrides: Record<string, string> = {}, registry: readonly VoiceSpec[] = VOICES): Cast {
  const speakers = speakersOf(script);
  const used = new Set<string>();
  const roles: Role[] = speakers.map((speaker) => {
    const requested = overrides[speaker.key];
    const id = requested ? approvedVoice(requested, `cast.${speaker.key}`, registry) : distinctVoice(speaker.kind, script.id, used, registry);
    if (!id) return { role: speaker.key, kind: speaker.kind, name: speaker.key };
    const spec = registry.find((voice) => voice.id === id);
    if (!spec) throw new Error(`cast.${speaker.key}: missing voice`);
    if (!spec.kinds.includes(speaker.kind)) throw new Error(`${spec.name} is not approved for the ${speaker.kind} role`);
    if (used.has(id)) throw new Error(`${spec.name} is already assigned to another speaker`);
    used.add(id);
    return { role: speaker.key, kind: speaker.kind, name: spec.name, voice: { id, ...(spec.tag ? { tag: spec.tag } : {}) } };
  });
  for (const key of Object.keys(overrides)) {
    if (!speakers.some((speaker) => speaker.key === key))
      throw new Error(`--voice ${key}: the lesson has no role "${key}". Roles: ${roles.map((role) => role.role).join(", ")}.`);
  }
  script.shots.forEach((shot, si) => shot.beats.forEach((beat, bi) => {
    if (beat.speaker && !roles.some((role) => role.role === beat.speaker))
      throw new Error(`Shot ${si + 1}, beat ${bi + 1}: speaker "${beat.speaker}" is not in the cast (${roles.map((role) => role.role).join(", ")}).`);
  }));
  return { roles, named: roles.length > 1 };
}

/** Persist with timing so render and playback use the voices that were recorded. Keyed by speaker key. Unbound speakers are omitted. */
export const voiceBindings = (cast: Cast): Record<string, string> =>
  Object.fromEntries(cast.roles.flatMap((role) => (role.voice ? [[role.role, role.voice.id] as const] : [])));

/**
 * Voicing calls this. A dry check does not.
 * Two speakers never share a voice. A speaker without one fails here, by kind.
 */
export function requireVoices(cast: Cast): void {
  const seen = new Set<string>();
  for (const role of cast.roles) {
    const id = role.voice?.id;
    if (!id || seen.has(id)) throw new Error(`${role.role} needs another approved ${role.kind} voice`);
    seen.add(id);
  }
}

/** The speaker of a beat: its `speaker`, or the first speaker. */
export const speakerOf = (cast: Cast, beat: { speaker?: string }) =>
  cast.roles.find((role) => role.role === beat.speaker) ?? cast.roles[0]!;

export type Run = { shot: number; from: number; to: number; role: Role; text: string };
/**
 * One take per run of consecutive beats by the same speaker, shot by shot. A
 * lesson with one voice has exactly one run per shot, as before.
 */
export function runsOf(script: Pick<Script, "shots">, cast: Cast): Run[] {
  const out: Run[] = [];
  script.shots.forEach((shot, si) => {
    let cur: Run | undefined;
    shot.beats.forEach((beat, bi) => {
      const role = speakerOf(cast, beat);
      if (cur && cur.role.role === role.role) { cur.to = bi; cur.text += ` ${beat.say}`; return; }
      cur = { shot: si, from: bi, to: bi, role, text: beat.say };
      out.push(cur);
    });
  });
  return out;
}

/** The runs before and after this one by the same voice: context for its prosody. */
export function neighbours(runs: Run[], i: number): { prev?: string; next?: string } {
  const id = runs[i]!.role.voice?.id;
  if (!id) return {};
  let prev: string | undefined, next: string | undefined;
  for (let k = i - 1; k >= 0; k--) if (runs[k]!.role.voice?.id === id) { prev = runs[k]!.text; break; }
  for (let k = i + 1; k < runs.length; k++) if (runs[k]!.role.voice?.id === id) { next = runs[k]!.text; break; }
  return { prev, next };
}

/** The text sent to the voice: a per-voice tag, if any, then the words. */
export const spokenText = (voice: Voice, text: string) => (voice.tag ? `${voice.tag} ${voiceText(text)}` : voiceText(text));

/**
 * What a take's cache key is made of. The narrator's untagged takes keep the
 * key they always had, so nothing already paid for is voiced again. (The hash
 * itself is in voice.ts: this module also runs in the browser.)
 */
export function takeKeyParts(voice: Voice, text: string): unknown[] {
  const parts: unknown[] = [voice.id, MODEL, text];
  if (voice.tag) parts.push(voice.tag);
  const respelled = respellingKey(text);
  if (respelled) parts.push(respelled);
  return parts;
}

/** A bracketed audio tag ("[energetic]") is written, not spoken: it is no word of the script. */
export const isTagWord = (w: string) => /^\[[^\[\]]+\]$/.test(w.trim());

/** `<template>--<variant>` reads its own screenplay but takes facts and metadata from the template. */
export function templateOf(id: string) {
  const m = id.match(/^(.+?)--([\w-]+)$/);
  return { template: m ? m[1]! : id, variant: m ? m[2] : undefined };
}
