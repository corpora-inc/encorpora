/** Conservative label lanes, preserving the mathematical x coordinate. */
export function labelLanes(
  labels: readonly { center: number; text: string }[],
  pixelsPerCharacter: number,
  gap = 8,
): number[] {
  const ends: number[] = [];
  const result: number[] = [];
  const ordered = labels
    .map((label, index) => ({ ...label, index }))
    .sort((a, b) => a.center - b.center);
  for (const label of ordered) {
    const half =
      Math.max(
        pixelsPerCharacter,
        (label.text.length * pixelsPerCharacter) / 2,
      ) + 3;
    let lane = ends.findIndex((end) => end + gap < label.center - half);
    if (lane < 0) lane = ends.length;
    ends[lane] = label.center + half;
    result[label.index] = lane;
  }
  return result;
}
