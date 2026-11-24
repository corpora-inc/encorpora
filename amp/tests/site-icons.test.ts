import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { siteIcons } from "../scripts/site-icons.js";

const text = (path: string) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("every raster icon a page or the manifest names is one the site builds and the dev server serves", async () => {
  const icons = new Map(siteIcons(await text("public/favicon.svg")));
  const named = [
    ...[
      ...(await text("index.html")).matchAll(
        /<link rel="(?:icon|apple-touch-icon)" href="\/([^"]+\.(?:ico|png))"/g,
      ),
    ].map((match) => match[1]!),
    ...(
      JSON.parse(await text("public/site.webmanifest")) as {
        icons: { src: string }[];
      }
    ).icons.map((icon) => icon.src.slice(1)),
  ];
  assert.ok(named.includes("favicon.ico") && named.length >= 5, `${named}`);
  for (const name of named) {
    const bytes = icons.get(name);
    assert.ok(bytes?.length, `${name} is named and not built`);
    // An ICO's header, or a PNG's.
    assert.deepEqual(
      [...bytes.subarray(0, 4)],
      name.endsWith(".ico") ? [0, 0, 1, 0] : [0x89, 0x50, 0x4e, 0x47],
      name,
    );
    // The dev server serves the names this pattern covers (vite.config.ts).
    assert.match(name, /^(?:favicon\.ico|[a-z0-9-]*icon[a-z0-9-]*\.png)$/);
  }
});
