import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import type { Page } from "playwright";

type FeedbackStatus = "correct" | "incorrect" | "skipped";

/** A painted-pixel check: changing the color immediately below the sheet must
 * not change any pixel in its rectangular interior. Rounded corners are out. */
export async function assertOpaqueFeedback(
  page: Page,
  status: FeedbackStatus,
  evidenceName?: string,
) {
  const sheet = page.locator(`.practice-surface .feedback.${status}`);
  await sheet.waitFor();
  await page.waitForTimeout(260);
  const geometry = await page.evaluate(() => {
    const surface = document.querySelector<HTMLElement>(".practice-surface");
    const feedback = surface?.querySelector<HTMLElement>(".feedback");
    if (!surface || !feedback) throw new Error("Practice feedback is missing");
    const a = surface.getBoundingClientRect();
    const b = feedback.getBoundingClientRect();
    const candidates = [
      { gap: b.top - a.top, x: a.left + a.width / 2, y: (a.top + b.top) / 2 },
      {
        gap: a.bottom - b.bottom,
        x: a.left + a.width / 2,
        y: (a.bottom + b.bottom) / 2,
      },
      {
        gap: b.left - a.left,
        x: (a.left + b.left) / 2,
        y: a.top + a.height / 2,
      },
      {
        gap: a.right - b.right,
        x: (a.right + b.right) / 2,
        y: a.top + a.height / 2,
      },
    ];
    const control = candidates.find(
      (point) =>
        point.gap >= 10 &&
        point.x >= 0 &&
        point.x < innerWidth &&
        point.y >= 0 &&
        point.y < innerHeight,
    );
    if (!control) throw new Error("No visible underlay control pixel");
    const interior = {
      left: Math.ceil(Math.max(0, b.left + 20)),
      top: Math.ceil(Math.max(0, b.top + 20)),
      right: Math.floor(Math.min(innerWidth, b.right - 20)),
      bottom: Math.floor(Math.min(innerHeight, b.bottom - 20)),
    };
    if (
      interior.right - interior.left < 40 ||
      interior.bottom - interior.top < 40
    )
      throw new Error("Feedback interior is too small for pixel comparison");
    const underlay = document.createElement("div");
    underlay.dataset.feedbackOpacityUnderlay = "true";
    Object.assign(underlay.style, {
      position: "absolute",
      inset: "0",
      zIndex: "4",
      pointerEvents: "none",
    });
    surface.append(underlay);
    return { interior, control };
  });

  let first: Buffer;
  let second: Buffer;
  try {
    const paint = (color: string) =>
      page.evaluate(async (value) => {
        const underlay = document.querySelector<HTMLElement>(
          '[data-feedback-opacity-underlay="true"]',
        );
        if (!underlay) throw new Error("Opacity underlay is missing");
        underlay.style.backgroundColor = value;
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        );
      }, color);
    await paint("#ff00ff");
    first = await page.screenshot({ animations: "disabled", caret: "hide" });
    await paint("#00ff00");
    second = await page.screenshot({ animations: "disabled", caret: "hide" });
  } finally {
    await page.evaluate(() =>
      document
        .querySelector('[data-feedback-opacity-underlay="true"]')
        ?.remove(),
    );
  }

  const pixels = await page.evaluate(
    async ({ images, interior, control }) => {
      const decoded: {
        width: number;
        height: number;
        data: Uint8ClampedArray;
      }[] = [];
      for (const base64 of images) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++)
          bytes[index] = binary.charCodeAt(index);
        const bitmap = await createImageBitmap(
          new Blob([bytes], { type: "image/png" }),
        );
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas pixel context is unavailable");
        context.drawImage(bitmap, 0, 0);
        decoded.push({
          width: bitmap.width,
          height: bitmap.height,
          data: context.getImageData(0, 0, bitmap.width, bitmap.height).data,
        });
      }
      const [a, b] = decoded;
      if (!a || !b) throw new Error("Two screenshots are required");
      if (a.width !== b.width || a.height !== b.height)
        throw new Error("Screenshot dimensions changed");
      const scaleX = a.width / innerWidth;
      const scaleY = a.height / innerHeight;
      let changed = 0;
      let maxDifference = 0;
      for (let y = interior.top; y < interior.bottom; y++)
        for (let x = interior.left; x < interior.right; x++) {
          const index =
            (Math.floor(y * scaleY) * a.width + Math.floor(x * scaleX)) * 4;
          const difference = Math.max(
            Math.abs(a.data[index]! - b.data[index]!),
            Math.abs(a.data[index + 1]! - b.data[index + 1]!),
            Math.abs(a.data[index + 2]! - b.data[index + 2]!),
          );
          if (difference) changed++;
          maxDifference = Math.max(maxDifference, difference);
        }
      const controlIndex =
        (Math.floor(control.y * scaleY) * a.width +
          Math.floor(control.x * scaleX)) *
        4;
      return {
        changed,
        maxDifference,
        sampled:
          (interior.right - interior.left) * (interior.bottom - interior.top),
        controlDifference: Math.max(
          Math.abs(a.data[controlIndex]! - b.data[controlIndex]!),
          Math.abs(a.data[controlIndex + 1]! - b.data[controlIndex + 1]!),
          Math.abs(a.data[controlIndex + 2]! - b.data[controlIndex + 2]!),
        ),
      };
    },
    {
      images: [first.toString("base64"), second.toString("base64")],
      ...geometry,
    },
  );
  if (evidenceName && process.env.AMP_FEEDBACK_EVIDENCE) {
    await mkdir(process.env.AMP_FEEDBACK_EVIDENCE, { recursive: true });
    await Promise.all([
      writeFile(
        `${process.env.AMP_FEEDBACK_EVIDENCE}/${evidenceName}-magenta.png`,
        first,
      ),
      writeFile(
        `${process.env.AMP_FEEDBACK_EVIDENCE}/${evidenceName}-green.png`,
        second,
      ),
    ]);
  }
  assert.ok(
    pixels.controlDifference >= 100,
    `${status}: the two high-contrast underlays must both paint outside the sheet: ${JSON.stringify(pixels)}`,
  );
  assert.equal(
    pixels.changed,
    0,
    `${status}: feedback interior must hide the changing underlay: ${JSON.stringify(pixels)}`,
  );
  return pixels;
}
