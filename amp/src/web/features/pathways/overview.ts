type Position = readonly [number, number, number];

/** Fit actual node bounds below the camera controls and above the gesture hint. */
export function overviewCamera(
  positions: readonly Position[],
  width: number,
  height: number,
) {
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const p of positions)
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p[i]! - 2);
      max[i] = Math.max(max[i]!, p[i]! + 2);
    }
  const center = positions.length
    ? min.map((v, i) => (v + max[i]!) / 2)
    : [0, 0, 0];
  const top = Math.min(76, height * 0.25),
    bottom = Math.min(38, height * 0.15);
  const tangent = Math.tan(Math.PI / 9);
  const horizontal = (tangent * Math.max(40, width - 48)) / Math.max(1, height);
  const upper = tangent * (1 - (2 * top) / height),
    lower = tangent * (1 - (2 * bottom) / height);
  const vertical = tangent * (1 - (top + bottom) / height);
  let distance = 80;
  for (const p of positions) {
    const x = p[0] - center[0]!,
      y = p[1] - center[1]!,
      z = p[2] - center[2]!;
    distance = Math.max(
      distance,
      z + (Math.abs(x) + 3) / horizontal,
      (y + 3 + z * upper) / vertical,
      (-y + 3 + z * lower) / vertical,
    );
  }
  distance *= 1.06;
  const target: [number, number, number] = [
    center[0]!,
    center[1]! + (distance * tangent * (top - bottom)) / height,
    center[2]!,
  ];
  return {
    target,
    position: [target[0], target[1], target[2] + distance] as [
      number,
      number,
      number,
    ],
  };
}

/** Six readable callouts, anchored to the real neighborhood centers. */
export function overviewCallouts<T extends { x: number; y: number }>(
  anchors: T[],
  width: number,
  height: number,
) {
  const ordered = [...anchors].sort((a, b) => a.x - b.x);
  const half = Math.ceil(ordered.length / 2);
  const columns = [ordered.slice(0, half), ordered.slice(half)];
  return columns.flatMap((column, side) => {
    column.sort((a, b) => a.y - b.y);
    const edge = side
      ? Math.max(...column.map((a) => a.x)) + 62
      : Math.min(...column.map((a) => a.x)) - 62;
    const x = Math.max(62, Math.min(width - 62, edge));
    const start = Math.max(90, Math.min(...column.map((a) => a.y)) - 20);
    const end = Math.max(
      start,
      Math.min(height - 54, Math.max(...column.map((a) => a.y)) + 20),
    );
    const spread = Math.min(
      Math.max(0, height - 140),
      Math.max(58 * (column.length - 1), end - start),
    );
    const y0 = Math.max(
      86,
      Math.min(height - 54 - spread, (start + end - spread) / 2),
    );
    return column.map((a, i) => ({
      ...a,
      anchorX: a.x,
      anchorY: a.y,
      x,
      y: y0 + (i * spread) / Math.max(1, column.length - 1),
    }));
  });
}
