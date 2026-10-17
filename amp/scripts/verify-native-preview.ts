import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, webkit } from "playwright";
import { createServer } from "vite";
const directory = new URL("../artifacts/native-preview/", import.meta.url);
await mkdir(directory, { recursive: true });
const vite = await createServer({
  define: {
    "import.meta.env.VITE_AMP_AUTHORITY": JSON.stringify(
      "https://identity.example.test",
    ),
    "import.meta.env.VITE_AMP_CLIENT_ID": JSON.stringify(
      "native-test-web-config",
    ),
  },
  server: { host: "127.0.0.1", port: 4420, strictPort: true },
});
await vite.listen();
const browser = await (
  process.env.AMP_BROWSER === "webkit" ? webkit : chromium
).launch();
try {
  for (const configured of [false, true]) {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      const page = await browser.newPage({ viewport });
      page.setDefaultTimeout(10000);
      const requests: string[] = [],
        errors: string[] = [];
      page.on("pageerror", (error) => {
        errors.push(error.message);
        console.error(error.message);
      });
      await page.route(/^https:\/\/identity\.example\.test\//, (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.route("**/api/v1/**", (route) => {
        requests.push(route.request().url());
        return route.abort();
      });
      await page.addInitScript(
        `window.isTauri=true; window.nativeCalls=[]; window.failHealth=true; window.__TAURI_INTERNALS__={invoke:async(command,args)=>{window.nativeCalls.push({command,args}); if(command==='native_status') return {apiConfiguration:'${configured ? "configured" : "unconfigured"}',authentication:false,purchases:false,downloads:false,exports:false}; if(command==='read_public_resource') {if(window.failHealth){window.failHealth=false;throw Error('unavailable');} return {ok:true};} throw Error('Unexpected native command');}};`,
      );
      await page.goto("http://127.0.0.1:4420");
      await page
        .getByRole("heading", {
          name: "Native preview",
        })
        .waitFor();
      await page
        .getByText(
          configured
            ? "You can check the service connection."
            : "A learning service has not been configured for this preview.",
        )
        .waitFor();
      assert.equal(
        await page.getByRole("button", { name: "Parent sign in" }).count(),
        0,
      );
      if (configured) {
        const button = page.getByRole("button", { name: "Check connection" });
        const box = await button.boundingBox();
        assert.ok(
          box &&
            box.y >= 0 &&
            box.y + box.height <= viewport.height &&
            box.height >= 44,
        );
        await button.click();
        await page
          .getByText("The service could not be reached. You can try again.")
          .waitFor();
        await button.click();
        await page
          .getByText("Service reachable. Native sign-in is unavailable.")
          .waitFor();
      }
      assert.deepEqual(
        requests,
        [],
        "Native startup must never use relative browser API fetches",
      );
      assert.deepEqual(errors, []);
      const bounds = await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      }));
      assert.ok(
        bounds.width <= viewport.width && bounds.height <= viewport.height + 1,
        `Native preview overflow: ${JSON.stringify(bounds)}`,
      );
      const calls = await page.evaluate(
        () =>
          (
            window as unknown as {
              nativeCalls: { command: string; args: { resource?: string } }[];
            }
          ).nativeCalls,
      );
      assert.ok(
        calls.every(
          (call) =>
            call.command === "native_status" ||
            (call.command === "read_public_resource" &&
              call.args.resource === "health"),
        ),
      );
      await page.screenshot({
        path: new URL(
          `${configured ? "configured" : "disabled"}-${viewport.width}.png`,
          directory,
        ).pathname,
      });
      await page.close();
    }
  }
  console.log(
    "Native preview: six actual-app layouts, no browser auth/API calls, bounded public IPC only.",
  );
} finally {
  await browser.close();
  await vite.close();
}
