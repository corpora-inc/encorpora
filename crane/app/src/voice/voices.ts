/**
 * Pick the most natural on-device voice for read-aloud. Answers and procedure
 * steps are read in the field, so a voice that needs the network is never
 * chosen (the app is offline by design).
 */
export interface VoiceOption {
  id: string;
  language: string;
  name?: string | null;
  /** tauri-plugin-tts buckets: enhanced (iOS Enhanced/Premium), very_high, high, normal, default, low, very_low. */
  quality?: string | null;
  networkRequired?: boolean | null;
}

const RANK: Record<string, number> = { enhanced: 6, very_high: 5, high: 4, normal: 3, default: 2, low: 1, very_low: 0 };

export function pickVoice(voices: readonly VoiceOption[], lang: string): VoiceOption | null {
  const base = lang.toLowerCase().split("-")[0]!;
  const region = lang.toLowerCase();
  const usable = voices.filter((v) => !v.networkRequired && v.language.toLowerCase().replace("_", "-").split("-")[0] === base);
  if (usable.length === 0) return null;
  const score = (v: VoiceOption) => {
    const q = RANK[(v.quality ?? "").toLowerCase()] ?? 2;
    const named = /premium|enhanced|neural|natural/i.test(v.name ?? "") ? 1 : 0;
    const sameRegion = v.language.toLowerCase().replace("_", "-") === region ? 0.5 : 0;
    return q * 10 + named * 3 + sameRegion;
  };
  return usable.reduce((best, v) => (score(v) > score(best) ? v : best));
}
