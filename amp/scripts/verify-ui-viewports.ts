import assert from "node:assert/strict";
import type { Browser } from "playwright";
import { assertPhoneLandscapeSmoke } from "./ui-viewports";

/** The smoke check must allow scrolling without accepting clipped controls. */
export async function verifyLandscapeSmokeChecks(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 568, height: 320 } });
  const content = '<div style="height:200px"></div><button>Check</button>';
  try {
    await page.setContent(
      `<div style="height:80px;overflow:hidden"><div style="height:80px;overflow:auto">${content}</div></div>`,
    );
    await assertPhoneLandscapeSmoke(page, "nested scroll fixture");
    for (const overflow of ["hidden", "clip"]) {
      await page.setContent(
        `<div style="height:80px;overflow:${overflow}">${content}</div>`,
      );
      await assert.rejects(
        assertPhoneLandscapeSmoke(page, `${overflow} fixture`),
        /is clipped/,
      );
    }
    await page.setContent(
      '<button>Check</button><div style="position:fixed;inset:0;background:white"></div>',
    );
    await assert.rejects(
      assertPhoneLandscapeSmoke(page, "covered fixture"),
      /is covered/,
    );
    console.log(
      "Landscape smoke checks distinguish scrolling, clipping and covered controls.",
    );
  } finally {
    await page.close();
  }
}
