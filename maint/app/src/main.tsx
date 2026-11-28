import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setNamespace } from "@appkit/namespace.ts";
import { logError } from "@appkit/log.ts";
import "./styles.css";
import { brandCss } from "./brands/index.ts";
import { BRAND, PRODUCT } from "./config.ts";
import { App } from "./App.tsx";

setNamespace(PRODUCT.namespace);
document.title = PRODUCT.name;
window.addEventListener("error", (e) => logError("window", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => logError("promise", e.reason));

/** Bundled fonts, loaded before first paint: text never reflows when they arrive. */
const FONTS = ["400 1em 'Atkinson Hyperlegible Next'", "600 1em 'Atkinson Hyperlegible Next'", "700 1em 'Atkinson Hyperlegible Next'", "400 1em 'Source Serif 4'", "600 1em 'Source Serif 4'", "500 1em 'Atkinson Hyperlegible Mono'"];
function loadFonts(): Promise<unknown> {
  const all = Promise.all(FONTS.map((f) => document.fonts.load(f))).catch((e) => logError("fonts", e));
  // Never hold the app on a font: two seconds at most.
  return Promise.race([all, new Promise((r) => setTimeout(r, 2000))]);
}

async function boot() {
  const css = brandCss(BRAND);
  if (css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
  }
  await loadFonts();
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot().catch((e) => logError("boot", e));
