import main from "katex/dist/fonts/KaTeX_Main-Regular.woff2?url";
import mathItalic from "katex/dist/fonts/KaTeX_Math-Italic.woff2?url";
import mainBold from "katex/dist/fonts/KaTeX_Main-Bold.woff2?url";

// Start the math fonts with the app, not when the first problem renders them:
// a late font reflows the prompt and moves it after the first paint.
export function preloadMathFonts() {
  for (const href of [main, mathItalic, mainBold]) {
    if (
      Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel="preload"][as="font"]',
        ),
      ).some((link) => link.href === new URL(href, document.baseURI).href)
    )
      continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.crossOrigin = "anonymous";
    link.href = href;
    document.head.append(link);
  }
}

/** A typeset formula's font faces, as KaTeX's stylesheet declares them. */
const mathFaces = () =>
  typeof document === "undefined" || !document.fonts
    ? []
    : [...document.fonts].filter((face) => /KaTeX_/.test(face.family));

let ready: Promise<void> | undefined;
/**
 * Every math font face, loaded: resolved once each has its file (or failed,
 * which is logged). Fetching the files early (`preloadMathFonts`) is not
 * enough. A face starts loading only when text first uses it, and finishes a
 * frame or more after that text has painted in the fallback's widths; the
 * formula then takes its real width, and whatever is sized by it (a picker
 * as wide as its widest equation, a labelled answer row) moves under the
 * learner. Loading the faces themselves, ahead of the first formula, makes
 * every formula's box final in the frame it first paints, for the faces a
 * problem happens to use as much as for the common three.
 */
export function mathFontsReady(): Promise<void> {
  if (ready) return ready;
  const faces = mathFaces();
  // Before the stylesheet is in (or where there are no fonts to load): not
  // settled, so the next caller looks again.
  if (!faces.length) return Promise.resolve();
  ready = Promise.all(
    faces.map((face) =>
      face.load().catch((error: unknown) => {
        console.warn(`A math font didn’t load: ${face.family}`, error);
      }),
    ),
  ).then(() => undefined);
  return ready;
}

/** How long a screen with math waits for its fonts before it paints. */
export const MATH_FONT_WAIT_MS = 3_000;
/** For a route's loader: the math fonts, or the wait's end on a network too
 * slow to bring them (the formulas then settle when their fonts arrive, as
 * they did before, rather than holding the problem back). */
export function mathFontsBeforePaint(wait = MATH_FONT_WAIT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    mathFontsReady(),
    new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        console.warn("Math fonts were not ready before the screen painted");
        resolve();
      }, wait);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Start the files and the faces. `/` may be the pitch, which shows no math
 * (its document leaves these out, scripts/build-home-document.ts): boot.tsx
 * starts them once `/` resolves to the app; every other address starts them
 * now. */
export function startMathFonts() {
  preloadMathFonts();
  void mathFontsReady();
}
if (typeof location !== "undefined" && location.pathname !== "/")
  startMathFonts();
