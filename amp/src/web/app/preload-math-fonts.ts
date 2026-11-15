import main from "katex/dist/fonts/KaTeX_Main-Regular.woff2?url";
import mathItalic from "katex/dist/fonts/KaTeX_Math-Italic.woff2?url";
import mainBold from "katex/dist/fonts/KaTeX_Main-Bold.woff2?url";

// Start the math fonts with the app, not when the first problem renders them:
// a late font reflows the prompt and moves it after the first paint.
export function preloadMathFonts() {
  for (const href of [main, mathItalic, mainBold]) {
    if (
      Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel="preload"][as="font"]',
        ),
      ).some((link) => link.href === new URL(href, document.baseURI).href)
    )
      continue;
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.crossOrigin = "anonymous";
    link.href = href;
    document.head.append(link);
  }
}
// `/` may be the pitch, which shows no math (its document leaves these out,
// scripts/build-home-document.ts). main.tsx starts them once `/` resolves to
// the app; every other address starts them now.
if (location.pathname !== "/") preloadMathFonts();
