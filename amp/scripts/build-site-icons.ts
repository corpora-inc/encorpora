import { readFile, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";

/**
 * The raster icons, generated from `public/favicon.svg` at build time so the
 * repository holds one source and no binaries. A full-bleed version fills the
 * square for iOS (which rounds the corners itself); the maskable version keeps
 * the wave inside the safe zone Android crops to.
 */
const dist = new URL("../dist/", import.meta.url);
const source = await readFile(
  new URL("../public/favicon.svg", import.meta.url),
  "utf8",
);
const fullBleed = source.replace(' rx="15"', "");
const wave = /<path [^>]*\/>/.exec(source)?.[0];
if (!wave || !fullBleed.includes('<rect width="64" height="64" fill'))
  throw new Error("favicon.svg no longer has the expected tile and wave");
const maskable = fullBleed.replace(
  wave,
  `<g transform="translate(32 32) scale(.74) translate(-32 -32)">${wave}</g>`,
);
const render = (svg: string, size: number) =>
  Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng(),
  );

/** An ICO file holding PNG images, which every browser since 2007 reads. */
function ico(images: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

const outputs: [string, Buffer][] = [
  [
    "favicon.ico",
    ico([16, 32, 48].map((size) => ({ size, png: render(source, size) }))),
  ],
  ["apple-touch-icon.png", render(fullBleed, 180)],
  ["icon-192.png", render(source, 192)],
  ["icon-512.png", render(source, 512)],
  ["icon-maskable-512.png", render(maskable, 512)],
];
await Promise.all(
  outputs.map(([name, data]) => writeFile(new URL(name, dist), data)),
);
console.log(`Built ${outputs.length} site icons.`);
