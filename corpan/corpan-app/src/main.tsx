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

// Storage foundation bootstrap (non-blocking, after first paint):
//   1. Migrate any oversized localStorage blobs (phrase-pack/game catalog)
//      into the IndexedDB tier. This is the safety net for users upgrading
//      from a build that persisted those blobs to localStorage and hit the
//      production `QuotaExceededError`. Idempotent.
//   2. After migration, re-hydrate the catalog stores so a just-migrated blob
//      is picked up this session (the stores started their first hydrate from
//      IndexedDB on import; on a fresh upgrade the blob lands during step 1).
//   3. Reconcile the on-device analytics ring buffer with the cloud endpoint
//      (uploads anything the live path dropped while offline).
void (async () => {
  try {
    const { migrateOversizedLocalStorage } = await import(
      "@/util/storage/migrate"
    );
    const migrated = await migrateOversizedLocalStorage();
    if (migrated > 0) {
      const [{ usePhrasePackCatalogStore }, { useCatalogStore }] =
        await Promise.all([
          import("@/store/phrasePackCatalog"),
          import("@/store/catalog"),
        ]);
      await Promise.allSettled([
        usePhrasePackCatalogStore.persist?.rehydrate?.(),
        useCatalogStore.persist?.rehydrate?.(),
      ]);
    }
  } catch (err) {
    console.error("[main] storage migration failed:", err);
  }
  try {
    const { syncLocalEvents } = await import("@/util/analytics");
    await syncLocalEvents();
  } catch (err) {
    console.error("[main] analytics reconcile failed:", err);
  }
  // Harvest any Rust-panic breadcrumb from a prior run into on-device
  // analytics. A `panic = "abort"` build turns any Rust panic (app or a
  // statically-linked plugin) into an all-native libc abort() with no Java
  // frame — the unsymbolicated tombstone we otherwise can't diagnose. The
  // native hook wrote location/message/thread to disk before aborting; record
  // it once here, then it's cleared natively. Throws on non-Tauri (web dev) —
  // swallowed.
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const report = await invoke<string | null>("take_last_crash_report");
    if (report) {
      const { trackEvent } = await import("@/util/analytics");
      trackEvent("rust_panic", { context: String(report).slice(0, 500) });
    }
  } catch (err) {
    console.error("[main] crash report harvest failed:", err);
  }
})();
