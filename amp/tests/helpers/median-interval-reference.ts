/**
 * `medianInterval` as it was before its bootstrap kept a seed's stream
 * (src/schools/standing-math.ts): every draw from the generator, every time.
 * Tests hold the kept stream to exactly these numbers.
 */
import {
  random,
  SD_FLOOR,
  drawsFor,
  type Normal,
} from "../../src/schools/standing-math.js";

const sdOf = (student: Normal) => Math.max(SD_FLOOR, student.sd);
function gaussian(next: () => number) {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const value = spare;
      spare = null;
      return value;
    }
    const u = 1 - next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}
function select(values: Float64Array, length: number, k: number) {
  let low = 0;
  let high = length - 1;
  while (low < high) {
    const pivot = values[(low + high) >> 1]!;
    let i = low;
    let j = high;
    while (i <= j) {
      while (values[i]! < pivot) i++;
      while (values[j]! > pivot) j--;
      if (i <= j) {
        const swap = values[i]!;
        values[i] = values[j]!;
        values[j] = swap;
        i++;
        j--;
      }
    }
    if (k <= j) high = j;
    else if (k >= i) low = i;
    else return values[k]!;
  }
  return values[k]!;
}
const medianInPlace = (values: Float64Array, length: number) => {
  const upper = select(values, length, length >> 1);
  if (length % 2) return upper;
  let lower = -Infinity;
  for (let index = 0; index < length >> 1; index++)
    if (values[index]! > lower) lower = values[index]!;
  return (lower + upper) / 2;
};
const quantileOfSorted = (sorted: Float64Array, p: number) => {
  const at = p * (sorted.length - 1);
  const below = Math.floor(at);
  const above = Math.min(sorted.length - 1, below + 1);
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (at - below);
};

export function referenceMedianInterval(
  students: readonly Normal[],
  {
    seed = 1,
    draws = drawsFor(students.length),
    level = 0.95,
    mode = "posterior",
  }: {
    seed?: number;
    draws?: number;
    level?: number;
    mode?: "posterior" | "bootstrap";
  } = {},
) {
  const n = students.length;
  if (!n) return null;
  const sorted = [...students].sort((a, b) => a.mu - b.mu || a.sd - b.sd);
  const mus = Float64Array.from(sorted, (student) => student.mu);
  const sds = Float64Array.from(sorted, sdOf);
  const point = medianInPlace(Float64Array.from(mus), n);
  const next = random(seed);
  const normal = gaussian(next);
  const sample = new Float64Array(n);
  const medians = new Float64Array(draws);
  for (let draw = 0; draw < draws; draw++) {
    for (let index = 0; index < n; index++) {
      const pick = mode === "bootstrap" ? Math.floor(next() * n) : index;
      sample[index] = mus[pick]! + sds[pick]! * normal();
    }
    medians[draw] = medianInPlace(sample, n);
  }
  medians.sort();
  const tail = (1 - level) / 2;
  return {
    median: point,
    low: quantileOfSorted(medians, tail),
    high: quantileOfSorted(medians, 1 - tail),
  };
}
