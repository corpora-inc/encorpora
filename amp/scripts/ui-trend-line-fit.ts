import type { Page } from "playwright";
import {
  initialTrendPoints,
  trendPoints,
  type TrendLineFitResponse,
} from "../src/math/trend-line-fit";

/** Fill through the real keyboard handlers, never by setting React state. */
export async function fillTrendLine(
  page: Page,
  r: TrendLineFitResponse,
  raw: string,
) {
  const target = trendPoints(r, raw)!;
  const reset = page.getByRole("button", { name: "Reset", exact: true });
  if (await reset.isEnabled()) await reset.click();
  const start = initialTrendPoints(r);
  for (let i = 0; i < 2; i++) {
    await page.locator(".trend-handle").nth(i).focus();
    for (const [axis, step, low, high] of [
      [0, r.grid.xStep, "ArrowLeft", "ArrowRight"],
      [1, r.grid.yStep, "ArrowDown", "ArrowUp"],
    ] as const) {
      const distance = target[i]![axis] - start[i]![axis];
      for (let n = 0; n < Math.abs(distance) / step; n++)
        await page.keyboard.press(distance < 0 ? low : high);
    }
  }
  // A neutral horizontal line must also be submitted through an actual edit.
  if (JSON.stringify(target) === JSON.stringify(start)) {
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowDown");
  }
}
