# Corpán Plus JIT preview → full upgrade — on-device verification

This is the QA procedure for proving the **preview → full** narration upgrade on
a device with a **real, active Corpán Plus subscription**.

## Why a harness is needed

The reader's install path (`installManager.ts` → `installNarration`) decides
preview-vs-full by querying StoreKit / Play **directly** (`isCurrentlySubscribed`).
On a really-subscribed device **every** install fetches the FULL ZIP — so a
preview can never be installed naturally, and the JIT upgrade layer
(`maybeUpgradeOnOpen` in `upgradeManager.ts`, wired into appShell's
narration-open path) has nothing to upgrade.

The harness lets QA **force the preview condition**, then exercise the REAL
on-device upgrade path: native in-place install, `isPreviewInstalled` disk
reclassification, and the reader reload/resume.

It is **capability-safe**: `installPreview` only downloads the **public**,
unauthenticated preview ZIP, and the upgrade still uses the device's **real**
subscription to fetch the full ZIP. It cannot grant any entitlement the device
hasn't earned. It is deliberately **not** gated on `import.meta.env.DEV` — packs
are built in production mode even when loaded by a dev app, so a DEV gate would
tree-shake it away exactly when QA needs it. It is namespaced under one global,
matching the existing `window.__corpanDebug` convention, and removed on appShell
dispose.

## The console API: `window.__corpanUpgradeDebug`

Attached when appShell mounts (open the reader). All methods return Promises.

| Call | Does |
| --- | --- |
| `list()` | installed narrations (each carries the `full` flag) |
| `status(id)` | `'preview'` \| `'full'` \| `'unknown'` \| `'not-installed'` |
| `installPreview(id)` | force-install the **public** preview ZIP, record `full:false` |
| `jit(id)` | trigger the JIT upgrade directly (`maybeUpgradeOnOpen`) |
| `sweep()` | trigger the background sweep (`runUpgradeSweep`) |

## Procedure (Safari Web Inspector → the reader's WebView)

1. **Open the reader** so appShell mounts and the global attaches. In the Web
   Inspector, select the reader's WebView and open the Console.

2. **Pick a narration.** Either browse-install one normally first, or:
   ```js
   await window.__corpanUpgradeDebug.list()
   ```
   Choose one you do NOT already have full, and note its `narrationId`.

3. **Force the preview**, then confirm:
   ```js
   await window.__corpanUpgradeDebug.installPreview("<narrationId>")
   await window.__corpanUpgradeDebug.status("<narrationId>")  // → "preview"
   ```
   `"preview"` here proves the public preview ZIP landed and was recorded
   `full:false`.

4. **Trigger the JIT upgrade** via the REAL on-open path — open that book in the
   reader. Watch the console for:
   ```
   [upgradeManager] upgraded narration <id>
   ```
   and the reader reload. Or trigger the layer directly:
   ```js
   await window.__corpanUpgradeDebug.jit("<narrationId>")  // → true
   ```

5. **Confirm full:**
   ```js
   await window.__corpanUpgradeDebug.status("<narrationId>")  // → "full"
   ```
   In the reader: no end-of-preview paywall, it plays to the real end, and the
   library shows the full size.

## What each result proves

- **step 3 `"preview"`** — the force-preview seam installed the truncated public
  ZIP and recorded it as a preview (the condition that can't occur naturally on
  a subscribed device).
- **`[upgradeManager] upgraded narration <id>` + reload** — the real native
  **in-place** install (atomic backup-swap) ran while entitled, fetching the
  full ZIP with the device's real subscription.
- **step 5 `"full"`** — `isPreviewInstalled` reclassified the pack from disk /
  the recorded flag flipped to `full:true`: the bytes on disk are the full
  narration.
- **reader plays past the preview cutoff and resumes** — appShell persisted the
  bookmark, reloaded the now-full `segments.json`, and auto-continued.

## Note on the sweep (step vs. layer)

`sweep()` (`runUpgradeSweep`) **defers on iOS**: the background sweep is gated to
a CONFIRMED-unmetered link, and iOS WKWebView has no Network Information API, so
metering is unknown and the sweep stands down (layers 1 + 3 still deliver). That
is why **step 4's on-open path is the JIT layer specifically** — it runs on any
connection and is the layer this procedure verifies. Use `sweep()` only to
observe the deferral behavior.
