import { readFile, writeFile } from "node:fs/promises";
import { siteIcons } from "./site-icons";

/** The site's raster icons, into `dist` at build time (site-icons.ts). */
const dist = new URL("../dist/", import.meta.url);
const outputs = siteIcons(
  await readFile(new URL("../public/favicon.svg", import.meta.url), "utf8"),
);
await Promise.all(
  outputs.map(([name, data]) => writeFile(new URL(name, dist), data)),
);
console.log(`Built ${outputs.length} site icons.`);
