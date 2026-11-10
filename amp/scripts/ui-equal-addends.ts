import type { Page } from "playwright";
import type {
  EqualAddendsAnswer,
  EqualAddendsResponse,
} from "../src/math/equal-addends";

export async function fillEqualAddends(
  page: Page,
  r: EqualAddendsResponse,
  raw: string,
) {
  const a = JSON.parse(raw) as EqualAddendsAnswer;
  if (r.mode === "build")
    for (const key of ["rows", "columns"] as const)
      for (let n = 1; n < a[key]; n++)
        await page
          .getByRole("button", { name: `More ${key}`, exact: true })
          .click();
  for (let n = 2; n < a.addends.length; n++)
    await page
      .getByRole("button", { name: "Add another addend", exact: true })
      .click();
  for (let n = 2; n > a.addends.length; n--)
    await page
      .getByRole("button", { name: "Remove last addend", exact: true })
      .click();
  for (const [i, value] of a.addends.entries()) {
    await page
      .getByRole("button", { name: `Addend ${i + 1}:`, exact: false })
      .click();
    await page
      .getByRole("button", { name: `Number ${value}`, exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Total:", exact: false }).click();
  for (const digit of String(a.total))
    await page
      .getByRole("button", { name: `Number ${digit}`, exact: true })
      .click();
}
