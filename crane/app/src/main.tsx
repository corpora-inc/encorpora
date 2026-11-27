import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { PRODUCT } from "./config.ts";
import { openEngine } from "./engine/index.ts";
import { assistant, speech, voice } from "./lib/native.ts";
import { logError } from "./lib/log.ts";
import { useDevice } from "./store/device.ts";
import { applyTheme, useSettings } from "./store/settings.ts";
import { App } from "./App.tsx";

document.title = PRODUCT.name;
window.addEventListener("error", (e) => logError("window", e.error ?? e.message));
window.addEventListener("unhandledrejection", (e) => logError("promise", e.reason));

/** Bundled fonts, loaded before first paint: text never reflows when they arrive. */
const FONTS = ["400 1em Barlow", "500 1em Barlow", "600 1em Barlow", "600 1em 'Barlow Semi Condensed'", "700 1em 'Barlow Semi Condensed'"];
function loadFonts(): Promise<unknown> {
  const all = Promise.all(FONTS.map((f) => document.fonts.load(f))).catch((e) => logError("fonts", e));
  // Never hold the app on a font: two seconds at most.
  return Promise.race([all, new Promise((r) => setTimeout(r, 2000))]);
}

async function boot() {
  applyTheme(useSettings.getState().theme);
  document.documentElement.lang = useSettings.getState().lang;
  // Resolve the pack and device capabilities before first render, so no
  // screen renders twice and no control pops in later.
  const [, hasVoice, model] = await Promise.all([openEngine(), voice.available(), assistant.status(), loadFonts()]);
  useDevice.setState({ voice: hasVoice, speech: speech.available(), assistantModel: model.present ? model.model : null });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

boot().catch((e) => {
  logError("boot", e);
  const root = document.getElementById("root")!;
  root.textContent = "";
  const p = document.createElement("p");
  p.style.cssText = "padding:24px;font:18px system-ui";
  p.textContent = "The rules pack could not be opened. Restart the app; if this repeats, reinstall it.";
  root.append(p);
});
