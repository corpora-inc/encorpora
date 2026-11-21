/**
 * The no-flash judgement (scripts/verify-no-flash-ui.ts), pure: what a cold
 * load painted, frame by frame, and what was wrong with it. The page's own
 * observer records each change of identity (the address, the title, the
 * bar's place and tabs, the main landmark, the heading) and each move of
 * the address.
 */

export type Id = {
  t: number;
  url: string;
  title: string;
  bar: string;
  tabs: string;
  main: string;
  h1: string;
  sheet: string;
  boot: boolean;
  wait: boolean;
};
export type Hop = { t: number; from: string; to: string; how: string };
export type Load = {
  ids: Id[];
  hops: Hop[];
  shifts: { t: number; v: number }[];
};

/** The neutral frame: the boot wave alone, or nothing painted yet. */
const neutral = (id: Id) =>
  !id.bar && (id.boot || (!id.main && !id.h1 && !id.sheet));
/** The parts of a frame that say where you are. */
const where = (id: Id) => JSON.stringify([id.url, id.bar, id.tabs, id.main]);
const label = (id: Id) =>
  neutral(id)
    ? "wave"
    : `${id.bar || "no bar"}${id.tabs ? ` [${id.tabs}]` : ""} ${id.main}${id.h1 ? ` "${id.h1}"` : ""}${id.sheet ? ` sheet "${id.sheet}"` : ""}${id.wait ? " …" : ""}`;

/** What a load did wrong, if anything. */
export function judge({ ids = [], hops = [], shifts = [] }: Load) {
  const problems: string[] = [];
  const painted = ids.filter((id) => !neutral(id));
  const final = painted.at(-1);
  if (!final) return { problems: ["nothing painted"], trail: "" };
  // The frames after the wave, as the person saw them: one state per
  // identity, a wait inside the destination's own frame folded into it.
  const steps: Id[] = [];
  for (const id of painted) {
    const lastStep = steps.at(-1);
    if (
      lastStep &&
      where(lastStep) === where(id) &&
      lastStep.h1 === id.h1 &&
      lastStep.sheet === id.sheet
    )
      continue;
    steps.push(id);
  }
  // A step of the destination's own: its frame, its heading (or none yet,
  // its skeleton holding the place).
  // The app frame alone (its bar, its wave) counts as the destination's
  // when it is the destination's bar.
  const own = (id: Id) =>
    (where(id) === where(final) ||
      (!id.main &&
        !id.h1 &&
        where({ ...id, main: final.main }) === where(final))) &&
    (id.h1 === final.h1 || (!id.h1 && id.wait)) &&
    (id.sheet === final.sheet || (!id.sheet && id.wait));
  const others = steps.filter((id) => !own(id));
  if (others.length)
    problems.push(
      `${others.length} other screen(s) before it: ${others.map(label).join(" → ")}`,
    );
  // A wait in the destination's frame, then the destination: one frame
  // after the wave at most.
  const inside = steps.filter(own);
  if (inside.length > 2)
    problems.push(`${inside.length - 1} changes inside the destination`);
  const firstPaint = painted[0]!.t;
  const titles = [...new Set(painted.map((id) => id.title))];
  if (titles.length > 1) problems.push(`title changed: ${titles.join(" → ")}`);
  if (hops.length > 1)
    problems.push(
      `${hops.length} hops: ${hops.map((hop) => hop.to).join(" → ")}`,
    );
  const late = hops.filter((hop) => hop.t > firstPaint);
  if (late.length)
    problems.push(
      `moved after the first paint: ${late.map((hop) => hop.to).join(" → ")}`,
    );
  // Layout shift once the destination itself first painted.
  const arrived = painted.find(own)?.t ?? final.t;
  const cls = shifts
    .filter((shift) => shift.t >= arrived - 1)
    .reduce((sum, shift) => sum + shift.v, 0);
  if (cls > 0.001) problems.push(`layout shift ${cls.toFixed(3)}`);
  const trail = [
    ...(ids.some(neutral) ? ["wave"] : []),
    ...steps.map(label),
  ].join(" → ");
  return { problems, trail };
}
