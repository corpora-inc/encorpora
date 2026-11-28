import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setNamespace } from "@appkit/namespace.ts";
import { logError } from "@appkit/log.ts";
import { assistant, configureNative, voice } from "@appkit/native.ts";
import { EngineError, hubCall } from "./engine/client.ts";
import "./styles.css";
import { brandCss } from "./brands/index.ts";
import { BRAND, PRODUCT } from "./config.ts";
import { App, BootFailed } from "./App.tsx";
import { useDevice } from "./store/device.ts";
import { useFleet } from "./store/fleet.ts";
import { usePack } from "./store/pack.ts";
import { applyTheme, useSettings } from "./store/settings.ts";

setNamespace(PRODUCT.namespace);
// No speech model is bundled yet: voice reports unavailable and the microphone is never offered.
configureNative({ voiceModel: "", voicePrompt: "", bundleId: PRODUCT.bundleId });
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

const DESIGN_ONLY = location.pathname.startsWith("/design");

async function boot() {
  const css = brandCss(BRAND);
  if (css) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
  }
  applyTheme(useSettings.getState().theme);
  const root = createRoot(document.getElementById("root")!);
  // The pack and the fleet are read before the first screen, so no screen renders twice.
  // The design gallery needs neither.
  try {
    const [, hasVoice, model, hub] = await Promise.all([
      loadFonts(),
      voice.available(),
      assistant.status(),
      // A review screen only where a hub answers; never an error when it does not.
      // Any answer from the hub, even "sign in first", means this screen can reach it.
      DESIGN_ONLY ? false : hubCall("hub.whoami", {}).then(() => true, (e: unknown) => e instanceof EngineError && e.code !== "unreachable" && e.code !== "internal"),
      DESIGN_ONLY ? null : usePack.getState().load(),
      DESIGN_ONLY ? null : useFleet.getState().refresh(),
    ]);
    useDevice.setState({ voice: hasVoice, assistantModel: model.present ? model.model : null, hub });
  } catch (e) {
    logError("boot", e);
    root.render(<BootFailed error={e} />);
    return;
  }
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void boot();
