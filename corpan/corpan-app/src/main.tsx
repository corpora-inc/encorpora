import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import App from "./App";
import "./i18n";
import LanguageSynchronizer from "./components/LanguageSynchronizer";
import { getVoices, getVoicesCached } from "@/util/tts-voices";
import { initAnalytics } from "@/util/analytics";
import { installDevKeepAwake } from "@/util/devKeepAwake";

// DEV-only: hold a screen wake lock so the iPad debug loop survives the idle
// timer. No-op in production builds.
if (import.meta.env.DEV) installDevKeepAwake();

// Ad-hoc debug surface — reachable from the Safari Web Inspector console
// even on builds where `window.__TAURI__` isn't exposed. Examples:
//
//   await window.__corpanDebug.dumpVoices()           // logs + clipboard
//   await window.__corpanDebug.dumpVoices("lt")       // filter by lang base
//
// Mirror of `__corpanI18n` pattern — namespace under one global, not free
// at top-level.
;(window as unknown as { __corpanDebug?: object }).__corpanDebug = {
  getVoices,
  getVoicesCached,
  async dumpVoices(filter?: string) {
    const voices = await getVoices();
    const subset = filter
      ? voices.filter((v) =>
          (v.language || "").toLowerCase().startsWith(filter.toLowerCase()),
        )
      : voices;
    const json = JSON.stringify(subset, null, 2);
    // eslint-disable-next-line no-console
    console.log(
      `[__corpanDebug] ${subset.length}/${voices.length} voices${filter ? ` (filter=${filter})` : ""}`,
      subset,
    );
    // eslint-disable-next-line no-console
    console.log("[__corpanDebug] unique language tags:",
      [...new Set(voices.map((v) => v.language))].sort());
    try {
      await navigator.clipboard?.writeText(json);
      // eslint-disable-next-line no-console
      console.log("[__corpanDebug] copied to clipboard");
    } catch {
      // eslint-disable-next-line no-console
      console.log("[__corpanDebug] (clipboard unavailable; full JSON above)");
    }
    return subset;
  },
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* App-wide motion baseline: one tasteful easing/duration is the DEFAULT for
        every framer-motion animation that doesn't specify its own, and all of
        them respect the OS "reduce motion" setting. This is the global
        smoothness lever — so we never ship ad-hoc half-baked tweens. */}
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}>
      <LanguageSynchronizer>
        <App />
      </LanguageSynchronizer>
    </MotionConfig>
  </React.StrictMode>
);

// Init analytics AFTER render so the app is interactive first (plan §7 C6).
// Idempotent; safe if HMR re-runs this module in dev.
initAnalytics();
