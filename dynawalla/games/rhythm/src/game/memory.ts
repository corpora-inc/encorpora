/**
 * WHERE THE RUN LEFT OFF.
 *
 * SPLITBEAT had no persistence of any kind — not one `localStorage` call in the
 * whole pack — so every run began at difficulty 1 and every scrap of adaptation
 * a child earned was thrown away the moment they closed it. For a child who is
 * struggling that is the worst possible arrangement: the game learns to be
 * gentle over four minutes and then forgets, and tomorrow it starts by being
 * too hard again. *"If you keep sucking and losing then it should just get
 * easier/stay easy"* is a claim about days, not only about minutes.
 *
 * ONE small key. Packs share a single ~5 MB `localStorage` budget with the host
 * origin, so this stores three floats and nothing else — no history, no run
 * log, no scores.
 *
 * Every failure is LOUD. Private browsing, a full quota and a disabled storage
 * partition all throw here, and a silent catch would turn "the adaptation is not
 * sticking" into an unfalsifiable user report.
 */

const KEY = "dw.rhythm.flow.v1";

export type FlowMemory = {
  intensity: number;
  gateSuccess: number;
  noteSuccess: number;
};

const ok = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function loadFlow(): FlowMemory | null {
  let raw: string | null = null;
  try {
    raw = globalThis.localStorage?.getItem(KEY) ?? null;
  } catch (err) {
    console.warn("[splitbeat] could not read the remembered pace", err);
    return null;
  }
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FlowMemory>;
    if (!ok(v.intensity) || !ok(v.gateSuccess) || !ok(v.noteSuccess)) {
      console.warn("[splitbeat] remembered pace was malformed; starting fresh", raw);
      return null;
    }
    return { intensity: v.intensity, gateSuccess: v.gateSuccess, noteSuccess: v.noteSuccess };
  } catch (err) {
    console.warn("[splitbeat] remembered pace would not parse; starting fresh", err);
    return null;
  }
}

export function saveFlow(m: FlowMemory): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(m));
  } catch (err) {
    console.warn("[splitbeat] could not remember the pace for next time", err);
  }
}
