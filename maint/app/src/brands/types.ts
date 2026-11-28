/** The colour tokens a brand may override (see styles.css). */
export type Token =
  | "page" | "surface" | "surface-2" | "surface-3" | "line" | "line-strong"
  | "ink" | "ink-2" | "ink-3" | "sheet" | "sheet-line" | "plate" | "plate-ink"
  | "field" | "field-wash" | "field-ink" | "focus";

export interface Brand {
  id: string;
  /** The product name, shown everywhere the app names itself. */
  name: string;
  bundleId: string;
  publisher: string;
  /** Key prefix for everything kept on the device. */
  namespace: string;
  /** Token overrides per theme; empty keeps the house look. */
  light: Partial<Record<Token, string>>;
  dark: Partial<Record<Token, string>>;
}
