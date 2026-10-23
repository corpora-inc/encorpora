import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// A fresh browser context contains no parent cookies or learner identities.
// The retained banner explicitly identifies all illumination as sample data.
const origin = new URL(process.env.AMP_MAP_ORIGIN ?? "http://127.0.0.1:4364");
if (!["http:", "https:"].includes(origin.protocol))
  throw new Error("Expected an HTTP origin");
const output = "artifacts/pathways-campaign";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: output, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();
  await page.goto(new URL("/pathways?preview=illumination", origin).href);
  await page.locator(".pathways-canvas canvas").waitFor();
  await page.locator(".pathways-demo").waitFor();
  if (await page.evaluate(() => document.fullscreenEnabled))
    await page
      .getByRole("button", { name: "Full screen", exact: true })
      .click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${output}/curriculum-overview.png` });
  await page
    .getByRole("searchbox", { name: "Find a skill", exact: true })
    .fill("Quadratic");
  await page.locator(".pathways-skill-list button").first().click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${output}/connected-pathways.png` });
  await page.getByRole("button", { name: "3D orbit", exact: true }).click();
  const box = (await page.locator(".pathways-canvas").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, {
    steps: 70,
  });
  await page.mouse.up();
  await page.waitForTimeout(2000);
  await context.close();
  console.log(
    `Campaign preview captures: ${output} (sample illumination, no learner data)`,
  );
} finally {
  await browser.close();
}
