/**
 * The cast: who speaks each beat, and which voice says it.
 *
 * A lesson may name a cast (roles mapped to approved voices) and give each
 * beat a speaker; a lesson without one is read by the narrator. The voice
 * mapping is separate from the words: `--voice role=voice` on make.ts re-voices
 * a role without touching the screenplay, so the same lesson can be read by a
 * different narrator. Everything here is pure (and free of node modules, so
 * the stage can import it in the browser), so it is tested with vitest.
 */
import type { Script, SpeakerRole } from "./schema";

/** Role eligibility, display names and delivery tags are casting data. */
export const APPROVED: Record<string, { short: string; name: string; roles: SpeakerRole[]; tag?: string }> = {
  XescS24CsOySAkKrLAO3: { short: "madeline", name: "Madeline Brousseaux", roles: ["teacher", "narrator"] },
  J3Ei0Lj6fAobhIqY5ySH: { short: "paul", name: "Paul", roles: ["teacher", "narrator"] },
  SYXbTJsLE7zmSjr1DchT: { short: "champ", name: "Champ", roles: ["learner"], tag: "[energetic]" },
};
/** Preserve the voice of existing solo screenplays. */
export const NARRATOR_ID = "XescS24CsOySAkKrLAO3";
export const MODEL = "eleven_v4";
/** Silence between two speakers' turns: a breath, like a real exchange. */
export const TURN_GAP = 0.5;

export type Voice = { id: string; tag?: string };
export type Role = { role: SpeakerRole; name: string; voice: Voice };
export type Cast = { roles: Role[]; named: boolean };

/** A voice by id or short name; throws when it is not approved. */
export function approvedVoice(v: string, where: string): string {
  if (Object.hasOwn(APPROVED, v)) return v;
  const byShort = Object.entries(APPROVED).find(([, a]) => a.short === v.toLowerCase());
  if (byShort) return byShort[0];
  throw new Error(`${where}: "${v}" is not an approved voice. Use one of: ${Object.entries(APPROVED).map(([id, a]) => `${a.short} (${id})`).join(", ")}.`);
}

/** FNV-1a over the film ID gives a stable choice independent of catalog order. */
export function defaultVoice(role: SpeakerRole, filmId: string): string {
  if (role === "narrator") return NARRATOR_ID;
  const eligible = Object.entries(APPROVED).filter(([, voice]) => voice.roles.includes(role));
  if (!eligible.length) throw new Error(`No approved voices for ${role}`);
  let hash = 2166136261;
  for (const char of filmId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return eligible[hash % eligible.length]![0];
}

/**
 * The roles of a script, in order, each with its on-screen name and voice.
 * `overrides` (role → voice id or short name) re-voice roles for this run; the
 * role `narrator` is the single voice of a script without a cast.
 */
export function resolveCast(script: Pick<Script, "id" | "cast" | "shots">, overrides: Record<string, string> = {}): Cast {
  const keys = script.cast && Object.keys(script.cast).length ? Object.keys(script.cast) : ["narrator"];
  const roles: Role[] = keys.map((key) => {
    if (!["teacher", "learner", "narrator"].includes(key)) throw new Error(`Unknown cast role "${key}"`);
    const role = key as SpeakerRole;
    const id = approvedVoice(overrides[role] ?? defaultVoice(role, script.id), `cast.${role}`);
    const voice = APPROVED[id]!;
    if (!voice.roles.includes(role)) throw new Error(`${voice.name} is not approved for the ${role} role`);
    return { role, name: voice.name, voice: { id, ...(voice.tag ? { tag: voice.tag } : {}) } };
  });
  for (const k of Object.keys(overrides)) if (!roles.some((r) => r.role === k)) throw new Error(`--voice ${k}: the lesson has no role "${k}". Roles: ${roles.map((r) => r.role).join(", ")}.`);
  script.shots.forEach((s, si) => s.beats.forEach((b, bi) => {
    if (b.speaker && !roles.some((r) => r.role === b.speaker))
      throw new Error(`Shot ${si + 1}, beat ${bi + 1}: speaker "${b.speaker}" is not in the cast (${roles.map((r) => r.role).join(", ")}).`);
  }));
  return { roles, named: roles.length > 1 };
}

/** Persist with timing so render and playback name the voices that were recorded. */
export const voiceBindings = (cast: Cast): Record<string, string> => Object.fromEntries(cast.roles.map((r) => [r.role, r.voice.id]));

/** The role that speaks a beat: its `speaker`, or the first role. */
export const speakerOf = (cast: Cast, beat: { speaker?: string }) => cast.roles.find((r) => r.role === beat.speaker) ?? cast.roles[0]!;

export type Run = { shot: number; from: number; to: number; role: Role; text: string };
/**
 * One take per run of consecutive beats by the same speaker, shot by shot. A
 * lesson with one voice has exactly one run per shot, as before.
 */
export function runsOf(script: Pick<Script, "shots">, cast: Cast): Run[] {
  const out: Run[] = [];
  script.shots.forEach((shot, si) => {
    let cur: Run | undefined;
    shot.beats.forEach((b, bi) => {
      const role = speakerOf(cast, b);
      if (cur && cur.role.role === role.role) { cur.to = bi; cur.text += ` ${b.say}`; return; }
      cur = { shot: si, from: bi, to: bi, role, text: b.say };
      out.push(cur);
    });
  });
  return out;
}

/** The runs before and after this one by the same voice: context for its prosody. */
export function neighbours(runs: Run[], i: number): { prev?: string; next?: string } {
  const id = runs[i]!.role.voice.id;
  let prev: string | undefined, next: string | undefined;
  for (let k = i - 1; k >= 0; k--) if (runs[k]!.role.voice.id === id) { prev = runs[k]!.text; break; }
  for (let k = i + 1; k < runs.length; k++) if (runs[k]!.role.voice.id === id) { next = runs[k]!.text; break; }
  return { prev, next };
}

/** The text sent to the voice: a per-voice tag, if any, then the words. */
export const spokenText = (voice: Voice, text: string) => (voice.tag ? `${voice.tag} ${text}` : text);

/**
 * What a take's cache key is made of. The narrator's untagged takes keep the
 * key they always had, so nothing already paid for is voiced again. (The hash
 * itself is in voice.ts: this module also runs in the browser.)
 */
export function takeKeyParts(voice: Voice, text: string): unknown[] {
  const parts: unknown[] = [voice.id, MODEL, text];
  if (voice.tag) parts.push(voice.tag);
  return parts;
}

/** A bracketed audio tag ("[energetic]") is written, not spoken: it is no word of the script. */
export const isTagWord = (w: string) => /^\[[^\[\]]+\]$/.test(w.trim());

/** `<template>--<variant>` reads its own screenplay but takes facts and metadata from the template. */
export function templateOf(id: string) {
  const m = id.match(/^(.+?)--([\w-]+)$/);
  return { template: m ? m[1]! : id, variant: m ? m[2] : undefined };
}


