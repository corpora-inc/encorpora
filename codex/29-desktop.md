# 29. Desktop

## What it is

Desktop is the third target Corpán ships to, covering macOS,
Windows, and Linux. The same Tauri binary that runs on iOS and
Android runs on the desktop too; the build path produces a
platform-native bundle (`.app` for macOS, `.exe` and `.msi` for
Windows, `.deb` and `.AppImage` for Linux) and the WebView is
the OS-provided one (`WKWebView` on macOS, `WebView2` on
Windows, `WebKitGTK` on Linux).

On desktop, the surface that needs adapting is small. The
WebView differences are absorbed by Tauri; the plugins that
matter on mobile (STT for pronunciation, IAP for paid content,
audio-keepalive for background playback) either stub out or
behave differently because the desktop user experience does not
ask for them today. Section 05's `desktop.rs` stub for the STT
plugin ("STT not supported on desktop in this build") is the
canonical example.

## How it fits

Desktop is the lightest-weight platform target in the codebase
not because the work is small but because the team has chosen
not to chase parity beyond the basics. The audiobook reader
works; the catalog works; the marketing site embed works. The
pronunciation coach does not, because nobody is asking for it
on desktop yet. When that changes, the desktop side grows
real behavior.

The reason for the asymmetry is the audience. Corpán's primary
users use phones for the listening and the drilling work. The
desktop target exists for development (`npm run tauri dev`),
for content authors who prefer a bigger screen, and for the
small set of users who want to listen on a laptop. The build
binary is real; the App Store / Microsoft Store / package
manager distribution is not the main channel.

## Files and entry points

- `corpan/corpan-app/src-tauri/tauri.conf.json`: the
  `app.windows[0]` block sets defaults for desktop window
  size (`1200 x 1000`) and devtools (`true`). The
  `bundle.macOS.signingIdentity` field carries the Mac App
  Store distribution certificate name
  (`"3rd Party Mac Developer Application: Corpora Inc (F9AV5HKF6N)"`).
- `corpan/corpan-app/src-tauri/icons/`: the icons used for
  bundle outputs across platforms. Tauri picks the right
  format per target.
- `corpan/plugins/<name>/src/desktop.rs`: each Tauri plugin's
  desktop module. Most are minimal: either they implement the
  command (TTS uses the OS-native speech synthesizer through
  the system's audio API) or they stub to "not supported"
  (STT, currently).
- `corpan/corpan-app/src-tauri/src/lib.rs:1232`
  (`open_apple_feedback`): the function exits with "Feedback
  Assistant is only available on Apple platforms" on Windows
  and Linux. Section 04 walks the worked example.

## How it works

### Tauri on desktop

`npm run tauri dev` from `corpan-app/` runs Vite (section 08)
and launches the Tauri binary. The binary opens a window
matching `tauri.conf.json`'s `app.windows[0]` config and
points its WebView at the Vite dev server. Edits to React land
in the running window through HMR; edits to Rust trigger a
binary rebuild and relaunch.

`npm run tauri build` produces platform-specific bundles. On
macOS the output is an `.app`, an `.dmg`, and (because of the
Mac App Store signing identity) the bits needed to submit to
the Mac App Store via Transporter or the Xcode Organizer. On
Windows the output is an `.exe`, an `.msi`, and an `.nsis`
installer. On Linux the output is a `.deb`, an `.AppImage`,
and (when configured) an `.rpm`.

### The WebView differences

The three desktop WebViews behave slightly differently:

- **macOS WKWebView**: closest to mobile Safari. Most Web
  features iOS supports work here too. Devtools opens through
  the Safari Web Inspector when the WebView's `allowsInspector`
  is enabled (Tauri exposes this; `devtools: true` in
  `tauri.conf.json`).
- **Windows WebView2**: Chromium-based. Devtools is the
  Chromium DevTools, opened via Right-click -> Inspect or
  `Ctrl+Shift+I`.
- **Linux WebKitGTK**: WebKit upstream, often a few versions
  behind Safari. Devtools is WebKitGTK's, opened via the same
  Right-click path.

The packs (section 11) target `es2020` (section 08), so
JavaScript syntax is uniform across all three. CSS uses the
Tailwind v4 vocabulary (section 09), which is broadly
compatible. The one place differences show up is Web Audio:
the iOS Opus-in-OGG story (section 18) is a WebKit gotcha that
affects macOS and Linux's WebKitGTK too; the WAV-for-in-zip
samples mitigation applies on desktop as well.

### The desktop plugins

Most Tauri plugins have a desktop module that either:

- Implements the plugin's behavior natively
  (`tauri-plugin-tts` calls into AVSpeechSynthesizer on macOS,
  SAPI on Windows, eSpeak NG on Linux).
- Stubs the behavior because the desktop user does not need it
  (`tauri-plugin-stt`'s `desktop.rs` returns `not supported`
  in this build).

The STT stub is intentional. Implementing whisper.cpp on
desktop is not technically hard (the model runs faster on a
laptop CPU than on a phone, in absolute terms), but the
pronunciation coach is not shipping on desktop and adding the
build complexity for an unshipped feature is the wrong call
today. The stub returns a clean `not available` from
`getStatus()`, and the pack's UI shows "Pronunciation coach is
not available on desktop." Section 05 walks the stub pattern.

### Window sizing and devtools

`tauri.conf.json` configures the desktop window:

```jsonc
"app": {
  "windows": [
    {
      "title": "Corpán",
      "devtools": true,
      "width": 1200,
      "height": 1000
    }
  ],
  "security": { "csp": null }
}
```

`width: 1200` and `height: 1000` is a deliberately generous
default; the reading experience benefits from a tall window.
`devtools: true` is on; for ship builds where devtools should
be off, a per-environment override is the path.

### Code signing

Mac App Store submission requires the
`"3rd Party Mac Developer Application: Corpora Inc (F9AV5HKF6N)"`
identity. Tauri's build picks it up from `tauri.conf.json` and
signs the `.app` bundle; uploading to App Store Connect goes
through Transporter or `xcrun altool`. Notarization (the
non-Mac-App-Store distribution path that opens the app outside
the store) requires a separate Developer ID Application
certificate; the codebase does not currently configure this.

Windows code signing requires an EV code signing certificate;
the codebase does not currently configure this for production
distribution. Linux distribution is unsigned (the convention).

## Common operations

1. **Run the app in desktop dev mode.** From
   `corpan/corpan-app/`: `npm run tauri dev`. Window opens
   matching the config defaults; React hot reload is wired.
2. **Build a desktop release.**
   `npm run tauri build`. Output appears in
   `src-tauri/target/release/bundle/`.
3. **Open the WebView devtools.** On macOS:
   Safari -> Develop -> [Mac name] -> [Corpán window]. On
   Windows: right-click anywhere -> Inspect. On Linux:
   right-click -> Inspect Element.
4. **Override the window size for development.** Edit
   `tauri.conf.json`'s `app.windows[0]` fields. Restart the
   dev binary.
5. **Verify a build's bundle structure.** On macOS:
   `ls -la target/release/bundle/macos/corpan.app/Contents/`.
   Tauri lays out the macOS bundle the same way Xcode would.
6. **Confirm a desktop plugin is stubbed correctly.** Call
   the plugin from a test pack or from the running app; check
   the return shape matches the `not supported` contract the
   stub declares.

## Why we built it this way

One Tauri binary across all three desktop OSes is the choice
that lets the same React tree, the same packs, and the same
SDK reach a third platform family without a parallel codebase.
The cost (a small set of platform-specific build configs and
the WebView differences) is contained; the benefit (a single
source of truth for "Corpán") is real.

Stubbing rather than implementing every plugin on desktop is
the choice that keeps the desktop build clean while leaving
room. The stub is honest: `getStatus()` returns
`available: false` and a human-readable message; the pack's UI
respects it. The day a desktop pronunciation coach makes sense
is the day to grow the stub into a real implementation.

The Mac App Store signing identity in `tauri.conf.json` is the
configuration the codebase commits to; the corresponding
keychain certificate lives on developer machines that ship Mac
App Store releases. Notarization for the non-Mac-App-Store
path and Windows code signing are deferred until the team
has a reason to ship outside the App Store; the cost of
configuring them is small but not free.

The generous default window size (1200 x 1000) is one of the
small choices that respects the reading experience on desktop.
A 800 x 600 default would crowd the paragraph view; the larger
window gives the reader room to breathe.

## To go deeper

- Tauri's "Building and Distributing" guide at
  `v2.tauri.app/develop/build/`.
- Apple's Mac App Store submission docs at
  `developer.apple.com/macos/submit/`.
- Microsoft's WebView2 docs at
  `learn.microsoft.com/en-us/microsoft-edge/webview2/`.
- WebKitGTK at `webkitgtk.org`.
- Section 04 for the Tauri runtime story; sections 27 and 28
  for the mobile counterparts.
