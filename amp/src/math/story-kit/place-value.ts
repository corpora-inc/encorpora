import type { Random } from "../variation/axes";
import { storyName } from "./names";

/** Fictional places a grade-4 item can name. Not real cities. */
const TOWNS = [
  "Maple Glen",
  "Cedar Bay",
  "Oak Ridge",
  "Pine Hollow",
  "Elm Fork",
  "Birch Landing",
  "Harbor Falls",
  "Summit Grove",
] as const;

const pick = <T>(r: Random, items: readonly T[]): T =>
  items[r(0, items.length - 1)]!;

const person = (r: Random) => storyName((n) => r(0, n - 1));

/**
 * One plain sentence about a large whole number, with a unit that fits
 * the size. The sentence does not end with a period. `grouped` is the
 * number already written with thousands separators.
 */
export function countContext(
  grouped: string,
  n: number,
  r: Random,
  /** Nearest-ten items should not be town populations. */
  fine = false,
): string {
  const options: Array<() => string> = [];
  if (n >= 8_000 && n <= 110_000)
    options.push(() => `A stadium holds ${grouped} seats`);
  if (n >= 2_000 && n <= 250_000)
    options.push(() => `The town library has ${grouped} books`);
  if (!fine && n >= 1_200 && n <= 80_000)
    options.push(() => `${pick(r, TOWNS)} has ${grouped} people`);
  if (!fine && n >= 80_000 && n <= 1_500_000)
    options.push(() => `The city of ${pick(r, TOWNS)} has ${grouped} people`);
  if (n >= 1_000_000 && n <= 2_000_000_000)
    options.push(() => `A census counted ${grouped} people`);
  if (n >= 1_000 && n <= 20_000)
    options.push(() => `${person(r)} scored ${grouped} points in a game`);
  if (n >= 20_000 && n <= 250_000)
    options.push(() => `${person(r)} scored ${grouped} points this season`);
  if (n >= 60_000 && n <= 120_000)
    options.push(() => `${person(r)} walked ${grouped} steps this month`);
  if (n >= 800_000 && n <= 4_000_000)
    options.push(() => `${person(r)} walked ${grouped} steps this year`);
  if (n >= 8_000 && n <= 60_000)
    options.push(() => `A class counted ${grouped} steps on a field-day walk`);
  if (n >= 400_000 && n <= 8_000_000)
    options.push(
      () =>
        `Students at a school counted ${grouped} steps altogether this year`,
    );
  if (n >= 1_000 && n <= 3_000)
    options.push(() => `The drive to ${pick(r, TOWNS)} is ${grouped} miles`);
  if (n >= 12_000 && n <= 45_000)
    options.push(() => `A delivery truck logged ${grouped} miles this year`);
  if (n >= 45_000 && n <= 20_000_000)
    options.push(
      () =>
        `Trucks in a delivery fleet drove ${grouped} miles altogether this year`,
    );
  if (n >= 5_000 && n <= 100_000)
    options.push(() => `A hiking trail is ${grouped} feet long`);
  if (!options.length) options.push(() => `The count is ${grouped}`);
  return options[n % options.length]!();
}
