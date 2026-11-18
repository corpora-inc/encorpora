import type { Locator, Page } from "playwright";

/**
 * Adds one child in the open "Add a child" sheet, as a parent does
 * (features/family/AddChildren.tsx): the name (optional), then the birth
 * year, which saves the child at once, then Done, which closes the sheet.
 * Returns the child the server made.
 */
export async function addChildInSheet(
  page: Page,
  { name = "", year = "2016" }: { name?: string; year?: string } = {},
): Promise<{ id: string; name: string }> {
  const sheet = page.getByRole("dialog", { name: "Add a child" });
  await sheet.waitFor();
  // The newest row is the one being added: "Name, Child 2 (…)".
  const field = sheet.getByRole("textbox", { name: /^Name, / }).last();
  if (name) await field.fill(name);
  // The field keeps what it takes (at most the name's maximum length).
  const kept = (await field.inputValue()).trim();
  const label = `Birth year, ${kept || (await rowLabel(field))}`;
  await sheet.getByRole("button", { name: label, exact: true }).click();
  const created = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/learners" &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("dialog", { name: label })
    .getByRole("option", { name: year, exact: true })
    .click();
  const response = await created;
  if (!response.ok())
    throw new Error(
      `Add a child: ${response.status()} ${await response.text()}`,
    );
  const child = (await response.json()) as { id: string; name: string };
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await sheet.waitFor({ state: "detached" });
  return child;
}

/** A blank row's own label ("Child 2"), from its field's placeholder. */
async function rowLabel(field: Locator) {
  return (await field.getAttribute("placeholder")) ?? "";
}
