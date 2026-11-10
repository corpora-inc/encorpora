import type { Page } from "playwright";
import type {
  CounterBuilderAnswer,
  CounterBuilderResponse,
} from "../src/math/counter-builder";

/** Fill through the same labelled touch and keyboard controls as a child. */
export async function fillCounterBuilder(
  page: Page,
  r: CounterBuilderResponse,
  raw: string,
) {
  const a = JSON.parse(raw) as CounterBuilderAnswer;
  for (const [i, count] of a.groups.entries()) {
    const add = page.getByRole("button", {
      name: `Add ${r.thing} to ${r.canRemove ? "starting group" : `group ${i + 1}`}.`,
      exact: false,
    });
    for (let n = 0; n < count; n++) await add.click();
  }
  for (let n = 0; n < a.removed; n++)
    await page.locator(".counter-cell").nth(n).click();
  for (const [i, value] of a.sentence.entries()) {
    await page.locator(".counter-slot").nth(i).click();
    await page
      .getByRole("button", {
        name:
          typeof value === "number"
            ? `Number ${value}`
            : value === "+"
              ? "Plus"
              : "Minus",
        exact: true,
      })
      .click();
  }
}
