/** Paint roles: each maps to a theme token (light, dark and print). */
export const inkRoles = [
  "ink",
  "axis",
  "grid",
  "accent",
  "warm",
  "gold",
  "muted",
  "paper",
] as const;
export const fillRoles = [
  "none",
  "paper",
  "empty",
  "ink",
  "accent",
  "warm",
  "gold",
  "accent-fill",
  "warm-fill",
  "gold-fill",
  "accent-strong",
  "gold-strong",
] as const;
export type InkRole = (typeof inkRoles)[number];
export type FillRole = (typeof fillRoles)[number];
