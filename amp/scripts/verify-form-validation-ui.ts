import { secureChromium } from "../browser-security.mjs";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium as rawChromium, webkit, type Page } from "playwright";
import { createServer } from "vite";
const chromium = secureChromium(rawChromium);

/**
 * One validation pattern for every form (ui/Form.tsx, ui/field-validation.ts),
 * on the founder's own case: sign-up's email, with Google and a passkey
 * offered, typed one key at a time.
 *
 * - While typing an incomplete address nothing is said and nothing blinks:
 *   no message, no `aria-invalid`, and no browser bubble (the form is
 *   `noValidate`, the field cancels `invalid`).
 * - Leaving the field says what is wrong in the field's reserved line, read
 *   as its description, in one line, and nothing on the card moves.
 * - Typing on, the message clears the moment the address is complete.
 *
 * At 320 and 1280 px, light and dark, in Chromium and WebKit. All API
 * traffic is answered here.
 */
const vite = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
});
await vite.listen();
const address = vite.httpServer!.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
const out = new URL("../artifacts/form-validation-ui/", import.meta.url)
  .pathname;
await mkdir(out, { recursive: true });

/** Boxes of everything on the sign-up card that could move. */
const boxes = (page: Page) =>
  page.evaluate(() =>
    [
      ...document.querySelectorAll<HTMLElement>(
        "main h1, main input, main button",
      ),
    ].map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );

let checked = 0;
try {
  for (const [name, engine] of [
    ["chromium", chromium],
    ["webkit", webkit],
  ] as const) {
    const browser = await engine.launch();
    try {
      for (const width of [320, 1280])
        for (const theme of ["light", "dark"] as const) {
          const label = `${name} ${width} ${theme}`;
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme: theme,
            reducedMotion: "reduce",
          });
          await context.route("**/*", async (route) => {
            const url = new URL(route.request().url());
            if (url.origin !== origin) return route.abort();
            if (url.pathname === "/api/v1/auth-config")
              return route.fulfill({
                json: {
                  mode: "accounts",
                  passwords: true,
                  providers: ["google"],
                  passkeySignup: true,
                  parentFollowup: true,
                },
              });
            if (url.pathname === "/api/auth/get-session")
              return route.fulfill({ json: null });
            if (url.pathname.startsWith("/api/"))
              return route.fulfill({ status: 204 });
            return route.continue();
          });
          const page = await context.newPage();
          const bubbles: string[] = [];
          page.on("dialog", (dialog) => {
            bubbles.push(dialog.message());
            void dialog.dismiss();
          });
          await page.goto(`${origin}/sign-up`);
          const email = page.getByRole("textbox", { name: /^Email/ }).first();
          await email.waitFor();
          await page.waitForTimeout(400);
          const form = email.locator("xpath=ancestor::form[1]");
          assert.equal(
            await form.evaluate((f: HTMLFormElement) => f.noValidate),
            true,
            `${label}: the sign-up form is noValidate`,
          );
          const describedBy = (await email.getAttribute("aria-describedby"))!;
          const note = page.locator(`[id="${describedBy.split(" ").at(-1)}"]`);
          const before = await boxes(page);
          // Every shift from here on counts, typed or not.
          if (name === "chromium")
            await page.evaluate(() => {
              const w = window as unknown as { shift: number };
              w.shift = 0;
              new PerformanceObserver((list) => {
                for (const entry of list.getEntries())
                  w.shift += (entry as unknown as { value: number }).value;
              }).observe({ type: "layout-shift" });
            });
          await email.click();
          // Every keystroke of the incomplete address: still quiet.
          for (const key of "skylar.saveland+passkey@") {
            await email.pressSequentially(key);
            assert.equal(
              await note.textContent(),
              "",
              `${label}: no message while typing ("${await email.inputValue()}")`,
            );
            assert.notEqual(
              await email.getAttribute("aria-invalid"),
              "true",
              `${label}: not marked invalid while typing`,
            );
          }
          assert.equal(await email.inputValue(), "skylar.saveland+passkey@");
          assert.deepEqual(
            await boxes(page),
            before,
            `${label}: typing moves nothing`,
          );
          await page.screenshot({
            path: `${out}${label.replaceAll(" ", "-")}-typing.png`,
          });
          // Leave the field: the message, in its reserved line.
          await email.press("Tab");
          await page.waitForTimeout(150);
          assert.equal(
            await note.textContent(),
            "Finish the address after the @.",
            `${label}: leaving the field says what is wrong`,
          );
          assert.equal(await email.getAttribute("aria-invalid"), "true");
          assert(await note.isVisible(), `${label}: the message shows`);
          const line = await note.evaluate((element) => {
            const style = getComputedStyle(element);
            return {
              height: element.getBoundingClientRect().height,
              line: parseFloat(style.lineHeight),
              right: element.getBoundingClientRect().right,
            };
          });
          assert(
            line.height <= line.line * 1.5,
            `${label}: the message is one line (${line.height} px)`,
          );
          assert(line.right <= width, `${label}: the message fits the screen`);
          assert.deepEqual(
            await boxes(page),
            before,
            `${label}: the message moves nothing`,
          );
          await page.screenshot({
            path: `${out}${label.replaceAll(" ", "-")}-blurred.png`,
          });
          // Finish the address: the message goes as soon as it is right.
          await email.focus();
          // The caret to the end (an email input has no selection API;
          // macOS keyboards move it with Cmd+Right).
          await email.press(
            process.platform === "darwin" ? "Meta+ArrowRight" : "End",
          );
          await email.pressSequentially("example.com");
          assert.equal(
            await email.inputValue(),
            "skylar.saveland+passkey@example.com",
          );
          assert.equal(await note.textContent(), "", `${label}: cleared`);
          assert.equal(await email.getAttribute("aria-invalid"), "false");
          assert.deepEqual(
            await boxes(page),
            before,
            `${label}: clearing moves nothing`,
          );
          assert.deepEqual(bubbles, [], `${label}: no browser dialog`);
          if (name === "chromium") {
            await page.waitForTimeout(100);
            const shifted = await page.evaluate(
              () => (window as unknown as { shift: number }).shift,
            );
            assert.equal(shifted, 0, `${label}: no layout shift`);
          }
          await page.screenshot({
            path: `${out}${label.replaceAll(" ", "-")}-valid.png`,
          });
          await context.close();
          checked++;
        }
    } finally {
      await browser.close();
    }
  }
} finally {
  await vite.close();
}
console.log(
  `Form validation verified in ${checked} engine, width and theme combinations.`,
);
