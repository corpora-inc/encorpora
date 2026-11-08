import main from "katex/dist/fonts/KaTeX_Main-Regular.woff2?url";
import mathItalic from "katex/dist/fonts/KaTeX_Math-Italic.woff2?url";
import mainBold from "katex/dist/fonts/KaTeX_Main-Bold.woff2?url";

// Start the math fonts with the app, not when the first problem renders them:
// a late font reflows the prompt and moves it after the first paint.
for (const href of [main, mathItalic, mainBold]) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "font";
  link.type = "font/woff2";
  link.crossOrigin = "anonymous";
  link.href = href;
  document.head.append(link);
}
