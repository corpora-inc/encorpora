import type { Timing, WordTime } from "./schema";

/** Captions and transcript share the display words from the film timing. */
export function captionText(timing: Timing) {
  const words = timing.shots.flat().flatMap((b) => b.words);
  const cues: WordTime[][] = [];
  let cur: WordTime[] = [];
  for (const w of words) {
    cur.push(w);
    const len = cur.map((x) => x.text).join(" ").length;
    if (/[.?!:]$/.test(w.text) || (len > 62 && /,$/.test(w.text)) || len > 74) { cues.push(cur); cur = []; }
  }
  if (cur.length) cues.push(cur);
  const fmt = (t: number, sep: string) => {
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(Math.floor(s)).padStart(2, "0")}${sep}${String(Math.round((s % 1) * 1000)).padStart(3, "0")}`;
  };
  const fix = (s: string) => s.replace(/\b([A-Z]) ([A-Z])\b/g, "$1$2");
  const wrap = (s: string) => {
    if (s.length <= 42) return s;
    const mid = s.length / 2;
    let best = -1;
    for (let i = 0; i < s.length; i++) if (s[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    return `${s.slice(0, best)}\n${s.slice(best + 1)}`;
  };
  const srt: string[] = [], vtt: string[] = ["WEBVTT\n"];
  cues.forEach((c, i) => {
    const a = c[0]!.start, b = Math.min(cues[i + 1]?.[0]!.start ?? c[c.length - 1]!.end + 0.4, c[c.length - 1]!.end + 0.5);
    const line = wrap(fix(c.map((x) => x.text).join(" ")));
    srt.push(`${i + 1}\n${fmt(a, ",")} --> ${fmt(b, ",")}\n${line}\n`);
    vtt.push(`${fmt(a, ".")} --> ${fmt(b, ".")}\n${line}\n`);
  });
  return { srt: srt.join("\n"), vtt: vtt.join("\n"), transcript: fix(words.map((w) => w.text).join(" ")) };
}
