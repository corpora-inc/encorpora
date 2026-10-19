/** Round away binary float noise: 0.1 + 0.2 is 0.3 here. */
export const clean = (v: number) => {
  const r = Math.round(v * 1e9) / 1e9;
  return Object.is(r, -0) ? 0 : r;
};
/** A number as a math label: minus sign, no float noise. */
export const num = (v: number) => {
  const r = clean(v);
  const text = Number.isInteger(r) ? String(r) : String(+r.toPrecision(10));
  return text.replace("-", "−");
};
export const signed = (v: number) => (v > 0 ? `+${num(v)}` : num(v));
/** A number as a screen reader should say it. */
export const spoken = (v: number) => {
  const r = clean(v);
  return r < 0 ? `negative ${num(-r)}` : num(r);
};
export const point = (x: number, y: number) => `(${num(x)}, ${num(y)})`;
export const spokenPoint = (x: number, y: number) =>
  `(${spoken(x)}, ${spoken(y)})`;
