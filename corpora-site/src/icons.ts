import { mkdir, writeFile } from "node:fs/promises";
import { Resvg } from "@resvg/resvg-js";
import type { SiteConfig } from "./config.js";

/** Browser bar colors, matching the page in each theme. */
export const lightSurface = "#f7f6f0";
export const darkSurface = "#122522";

// Corpora's "c." mark, in the same tile and glow as AMP's wave icon.
const defs =
  '<defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b2f33"/><stop offset="1" stop-color="#17685f"/></linearGradient><linearGradient id="w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7fe6c6"/><stop offset="1" stop-color="#f2fff9"/></linearGradient></defs>';
const mark =
  '<path d="M42 21.5a16.5 16.5 0 1 0 0 21" fill="none" stroke="url(#w)" stroke-width="7" stroke-linecap="round"/><circle cx="48.5" cy="47" r="4.2" fill="#f2fff9"/>';
const svg = (tile: string, content: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}${tile}${content}</svg>`;
const rounded = '<rect width="64" height="64" rx="15" fill="url(#t)"/>';
const square = '<rect width="64" height="64" fill="url(#t)"/>';
const render = (source: string, size: number) =>
  Buffer.from(
    new Resvg(source, { fitTo: { mode: "width", value: size } })
      .render()
      .asPng(),
  );

/** An ICO file holding PNG images, which every browser since 2007 reads. */
export function ico(images: { size: number; png: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size;
    entry[1] = size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

/** Every icon a browser or home screen asks for, and the files beside them. */
export async function writeIcons(output: string, config: SiteConfig) {
  const icon = svg(rounded, mark);
  const fullBleed = svg(square, mark);
  const maskable = svg(
    square,
    `<g transform="translate(32 32) scale(.74) translate(-32 -32)">${mark}</g>`,
  );
  await writeFile(`${output}/favicon.svg`, icon);
  await writeFile(
    `${output}/favicon.ico`,
    ico([16, 32, 48].map((size) => ({ size, png: render(icon, size) }))),
  );
  await writeFile(`${output}/apple-touch-icon.png`, render(fullBleed, 180));
  await writeFile(`${output}/icon-192.png`, render(icon, 192));
  await writeFile(`${output}/icon-512.png`, render(icon, 512));
  await writeFile(`${output}/icon-maskable-512.png`, render(maskable, 512));
  await writeFile(
    `${output}/site.webmanifest`,
    `${JSON.stringify(
      {
        name: "Corpora",
        short_name: "Corpora",
        start_url: "/",
        scope: "/",
        display: "browser",
        background_color: lightSurface,
        theme_color: lightSurface,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  await mkdir(`${output}/.well-known`, { recursive: true });
  await writeFile(
    `${output}/.well-known/security.txt`,
    [
      `Contact: mailto:${config.supportEmail ?? "support@corpora.inc"}`,
      "Expires: 2027-11-06T00:00:00.000Z",
      "Preferred-Languages: en",
      ...(config.siteUrl
        ? [
            `Canonical: ${new URL("/.well-known/security.txt", config.siteUrl).href}`,
          ]
        : []),
      "",
    ].join("\n"),
  );
}

/** Who publishes this site, for search engines. On the home page only. */
export function siteStructuredData(config: SiteConfig) {
  if (!config.siteUrl) return undefined;
  const organization = new URL("/#organization", config.siteUrl).href;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organization,
        name: "Corpora Inc",
        url: config.siteUrl,
        logo: new URL("/icon-512.png", config.siteUrl).href,
        email: config.supportEmail,
        sameAs: [
          "https://www.youtube.com/@corporainc",
          "https://www.instagram.com/adaptivemathpathways",
          "https://x.com/corporainc",
          "https://www.tiktok.com/@adaptivemathpathways",
        ],
      },
      {
        "@type": "WebSite",
        name: "Corpora",
        url: config.siteUrl,
        publisher: { "@id": organization },
      },
    ],
  };
}
