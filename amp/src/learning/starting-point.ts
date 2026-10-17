/** A family preference for initial probes; it is not assessment evidence. */
export const startingBands = ["K–2", "3–5", "6–8", "9–12"] as const;
export type StartingBand = (typeof startingBands)[number];
export type StartingPoint = {
  band: StartingBand | null;
  policyVersion: 1 | null;
};

/** Server-owned enrollment snapshot; saved only on the first preference choice. */
export type PracticeStartingPoint = StartingPoint & {
  excludedStrands: string[];
};
