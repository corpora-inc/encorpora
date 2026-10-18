import { mkdir, readFile, writeFile, cp, rm } from "node:fs/promises";
import React, { renderToStaticMarkup } from "./react.js";
import type { SiteConfig } from "./config.js";
import { Page, routes } from "./pages.js";
import { product } from "./product.js";
export async function buildSite(
  config: SiteConfig,
  output: "dist" | "artifacts/production" = "dist",
) {
  await rm(output, { recursive: true, force: true });
  await mkdir(`${output}/assets`, { recursive: true });
  // Extract the existing token block; loading the entire app stylesheet would
  // import app layout selectors into an unrelated document.
  const theme = await readFile("../amp/src/web/theme.css", "utf8");
  const tokens = theme.match(/:root\s*\{[^}]+\}/)?.[0];
  if (!tokens) throw new Error("AMP theme token block not found");
  await writeFile(
    `${output}/assets/site.css`,
    tokens + "\n" + (await readFile("src/site.css", "utf8")),
  );
  await cp(
    "../amp/node_modules/katex/dist/katex.min.css",
    `${output}/assets/katex.min.css`,
  );
  await cp("../amp/node_modules/katex/dist/fonts", `${output}/assets/fonts`, {
    recursive: true,
  });
  await writeFile(
    `${output}/assets/print.js`,
    'document.querySelector("[data-print]")?.addEventListener("click",()=>window.print());\n',
  );
  await writeFile(
    `${output}/favicon.svg`,
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f5f55"/><path d="M43 21a17 17 0 1 0 0 22" fill="none" stroke="#fffefa" stroke-width="7"/><circle cx="48" cy="48" r="4" fill="#fffefa"/></svg>',
  );
  for (const route of routes) {
    const dir = `${output}${route}`;
    await mkdir(dir, { recursive: true });
    await writeFile(
      `${dir}index.html`,
      "<!doctype html>" +
        renderToStaticMarkup(<Page route={route} config={config} />),
    );
  }
  await writeFile(
    `${output}/coverage.json`,
    JSON.stringify(
      {
        ...product,
        source: "AMP curriculum and content audit",
        limitations: [
          "Catalog presence does not prove efficacy, publication, or full standards coverage.",
          "Selected skills only; not complete K–12 or SAT coverage.",
        ],
      },
      null,
      2,
    ),
  );
  await writeFile(
    `${output}/robots.txt`,
    config.mode === "preview"
      ? "User-agent: *\nDisallow: /\n"
      : `User-agent: *\nAllow: /\nSitemap: ${new URL("/sitemap.xml", config.siteUrl).href}\n`,
  );
  if (config.siteUrl)
    await writeFile(
      `${output}/sitemap.xml`,
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map((r) => `<url><loc>${new URL(r, config.siteUrl).href.replaceAll("&", "&amp;")}</loc></url>`).join("")}</urlset>`,
    );
  console.log(
    `Built ${routes.length} static pages (${config.mode}); coverage audit valid.`,
  );
}
