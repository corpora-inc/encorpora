import { count, isAre } from "./agreement";
import { storyName } from "./story-kit/names";
import { surfaceStream, type Random } from "./variation/axes";

/** Story surfaces for grade-4 measurement and money.
 * The mathematical model stays on the content stream. Names, settings and
 * sentence frames come from this surface stream, so a plain (legacy) draw
 * is untouched. */

const cap = (text: string) => text[0]!.toUpperCase() + text.slice(1);
const pick = <T>(r: Random, xs: readonly T[]): T => xs[r(0, xs.length - 1)]!;

export function formatClock(mins: number): string {
  const t = ((mins % 1440) + 1440) % 1440;
  const h24 = Math.floor(t / 60);
  const m = t % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "a.m." : "p.m."}`;
}

const hm = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${count(h, "hour")} ${count(m, "minute")}`;
  if (h) return count(h, "hour");
  return count(m, "minute");
};

/** True when `label` appears as its own clock time, not as the tail of
 * another time ("1:05 p.m." inside "11:05 p.m."). */
export function clockTimePresent(text: string, label: string): boolean {
  const escaped = label.replaceAll(".", "\\.");
  return new RegExp(`(?<!\\d)${escaped}`).test(text);
}

function stream(templateId: string, seed: string): Random {
  return surfaceStream(templateId, seed);
}

/* ------------------------------------------------------------------ */
/* Elapsed time                                                        */
/* ------------------------------------------------------------------ */

type Act = string;

/** Two camp blocks. Each can honestly last from about 10 minutes to 2 hours. */
const TWO_BLOCKS: readonly (readonly [Act, Act])[] = [
  ["basketball", "swimming"],
  ["painting", "clay modeling"],
  ["piano practice", "choir"],
  ["the museum visit", "the planetarium show"],
  ["coding club", "robotics"],
  ["reading", "a board game"],
  ["the nature hike", "bird watching"],
  ["art class", "a gallery walk"],
  ["the spelling game", "the math game"],
  ["dance practice", "the music block"],
];

const ONE_BLOCKS: readonly Act[] = [
  "the hike to the overlook",
  "soccer practice",
  "the video game",
  "the movie",
  "piano practice",
  "art class",
  "the bike ride",
  "science club",
  "dance practice",
  "the library visit",
  "the drive to the park",
  "rehearsal",
];

function addMinutes(from: number, minutes: number): string[] {
  const to = formatClock(from + minutes);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const fromMin = ((from % 1440) + 1440) % 1440 % 60;
  if (mins === 0)
    return [
      `Add ${hm(minutes)} to ${formatClock(from)} The minutes stay put and the hour moves ahead. The time is ${to}`,
    ];
  const sum = fromMin + mins;
  if (sum < 60) {
    const lines = [
      `Start at ${formatClock(from)} Add ${count(mins, "minute")} to ${fromMin} minutes: ${fromMin} + ${mins} = ${sum}.`,
    ];
    if (hours)
      lines.push(
        `Then add ${count(hours, "hour")}. The time is ${to}`,
      );
    else lines.push(`The time is ${to}`);
    return lines;
  }
  const extra = Math.floor(sum / 60);
  const rem = sum % 60;
  const carry =
    rem === 0
      ? `${sum} minutes is exactly ${count(extra, "hour")}, so the clock crosses into the next hour.`
      : `${sum} minutes is ${count(extra, "hour")} and ${count(rem, "minute")}, so the clock crosses into the next hour.`;
  const lines = [
    `Start at ${formatClock(from)} Add ${count(mins, "minute")} to ${fromMin} minutes. ${carry}`,
  ];
  if (hours)
    lines.push(
      `Then add ${count(hours, "hour")}. The time is ${to}`,
    );
  else lines.push(`The time is ${to}`);
  return lines;
}

export function elapsedStory(
  templateId: string,
  seed: string,
  model: { start: number; durations: number[] },
): { prompt: string; hint: string; explanation: string[] } {
  const r = stream(templateId, seed);
  const name = storyName((n) => r(0, n - 1));
  const start = formatClock(model.start);
  const [d1, d2] = model.durations;
  const frame = r(0, 3);
  let prompt: string;
  let focus: string;
  if (d2 === undefined) {
    const act = pick(r, ONE_BLOCKS);
    focus = act;
    const lasts = `${cap(act)} lasts ${hm(d1!)}.`;
    if (frame === 0)
      prompt = `${name} starts ${act} at ${start} ${lasts} What time does ${act} end?`;
    else if (frame === 1)
      prompt = `At ${start} ${name} begins ${act}. It lasts ${hm(d1!)}. What time is ${name} done?`;
    else if (frame === 2)
      prompt = `${name} is busy with ${act} starting at ${start} It takes ${hm(d1!)}. What time does it end?`;
    else
      prompt = `The clock shows ${start} ${name} starts ${act} then. ${lasts} What time does ${name} finish?`;
  } else {
    const [first, second] = pick(r, TWO_BLOCKS);
    focus = second;
    if (frame === 0)
      prompt = `${name} starts ${first} at ${start} ${cap(first)} lasts ${hm(d1!)}. Then ${second} takes ${hm(d2)}. What time does ${second} end?`;
    else if (frame === 1)
      prompt = `At ${start} ${name} begins ${first}. After ${hm(d1!)}, ${name} spends ${hm(d2)} on ${second}. What time is ${name} finished?`;
    else if (frame === 2)
      prompt = `${name}'s camp block starts at ${start} with ${first} for ${hm(d1!)}. Next is ${second}, and that takes ${hm(d2)}. When does ${second} finish?`;
    else
      prompt = `The clock shows ${start} That is when ${name} begins ${first}, which runs for ${hm(d1!)}. ${cap(second)} comes next for ${hm(d2)}. What time does ${name} finish ${second}?`;
  }
  const explanation: string[] = [`The clock shows ${start}`];
  let at = model.start;
  for (const part of model.durations) {
    explanation.push(...addMinutes(at, part));
    at += part;
  }
  explanation.push(
    d2 === undefined
      ? `${cap(focus)} ends at ${formatClock(at)}`
      : `Both parts are done at ${formatClock(at)}`,
  );
  const hint =
    d2 === undefined
      ? `The clock shows ${start} Add ${hm(d1!)}. If the minutes reach 60, cross into the next hour.`
      : `The clock shows ${start} Add ${hm(d1!)}, then add ${hm(d2)}. If the minutes reach 60, cross into the next hour.`;
  return { prompt, hint, explanation };
}
