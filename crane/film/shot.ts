/** The figure mount crane films give the stage and the live player: a shot's {crane: ...} figure, drawn by mount.ts. */
import type { Shot } from "../../amp/film/schema";
import { mountCrane, type CraneMount } from "./mount";

type StageEntry = Parameters<typeof mountCrane>[2][number];

export function mountShot(host: HTMLElement, shot: Shot, list: readonly StageEntry[]): CraneMount {
  const fig = shot.figure;
  if (!fig || !("crane" in fig)) return { seek: () => {}, issues: ["a crane film's figures are {\"crane\": ...}: this shot's figure is from another kit."], notes: [] };
  return mountCrane(fig.crane, host, list);
}
