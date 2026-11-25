/**
 * A computed color as the screen paints it. Calm's roles compute to
 * `rgb()`; Colorful's are `oklch()` (ui/tokens.css), and a mixed role
 * computes to `color(srgb …)`. A check that reads the first three numbers
 * of whatever came back measures Calm only: under Colorful it took
 * `oklch(0.42 0.19 197)` for three near-black channels and called every
 * pair 1.00:1. The page's own canvas paints the color and says its sRGB.
 */
import type { Page } from "playwright";

export type Rgba = [number, number, number, number];

/** Each CSS color as sRGB (0 to 255) and alpha, painted by the page. */
export async function srgb(
  page: Page,
  colors: readonly string[],
): Promise<Rgba[]> {
  return page.evaluate(
    (values) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const pen = canvas.getContext("2d", { willReadFrequently: true })!;
      return values.map((value) => {
        if (!CSS.supports("color", value))
          throw new Error(`Not a color this page can paint: ${value}`);
        pen.clearRect(0, 0, 1, 1);
        pen.fillStyle = value;
        pen.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = pen.getImageData(0, 0, 1, 1).data;
        return [r!, g!, b!, a! / 255] as [number, number, number, number];
      });
    },
    [...colors],
  );
}

/** WCAG relative luminance of an sRGB color. */
export const luminance = ([r, g, b]: Rgba | [number, number, number]) =>
  [r, g, b].reduce((total, channel, i) => {
    const value = channel / 255;
    const linear =
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return total + linear * [0.2126, 0.7152, 0.0722][i]!;
  }, 0);

/** WCAG contrast ratio of two opaque sRGB colors. */
export const contrast = (a: Rgba, b: Rgba) => {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** The contrast of two computed colors, in whatever form they came back. */
export async function contrastOf(page: Page, a: string, b: string) {
  const [first, second] = await srgb(page, [a, b]);
  return contrast(first!, second!);
}
