import { DEFAULT } from "./default.ts";
import type { Brand, Token } from "./types.ts";

/** A customer build is a new file here plus VITE_BRAND=<id>; no screen changes. */
const BRANDS: Record<string, Brand> = { [DEFAULT.id]: DEFAULT };

export function brand(id: string | undefined): Brand {
  return (id && BRANDS[id]) || DEFAULT;
}

/** Token overrides as CSS, injected once before first paint. */
export function brandCss(b: Brand): string {
  const block = (sel: string, t: Partial<Record<Token, string>>) => {
    const decl = Object.entries(t).map(([k, v]) => `--${k}:${v};`).join("");
    return decl ? `${sel}{${decl}}` : "";
  };
  return [
    block(":root", b.light),
    block(":root[data-theme='dark']", b.dark),
    b.dark && Object.keys(b.dark).length ? `@media (prefers-color-scheme: dark){${block(":root:not([data-theme='light'])", b.dark)}}` : "",
  ].join("");
}

export type { Brand, Token };
