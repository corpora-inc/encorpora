// The showcase's files (./showcase/*.webp, made by
// scripts/capture-pitch-showcase.ts), served from this origin with hashed
// names like the rest of the app's assets. Only their URLs are in the code.
import { showcaseSizes } from "./showcase-slides";

const files = import.meta.glob<string>("./showcase/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/** One capture's URL: a practice screen in a shape and theme, or a page. */
export function showcaseFile(name: string): string {
  const url = files[`./showcase/${name}.webp`];
  if (!url) throw new Error(`showcase: no file ${name}.webp`);
  return url;
}

/** The phone framing (9:16 narrow captures); the pitch's first layout step
 * and `phoneVideoQuery` (video.ts) break at the same width. */
export const narrowQuery = "(max-width: 480px)";
export const darkQuery = "(prefers-color-scheme: dark)";
export { showcaseSizes };
