# iOS Viewport Height Fix (WKWebView)

## Problem
- On iOS (iPhone + iPad, portrait), the app initially rendered with ~50px whitespace at the bottom.
- The gap disappeared after a single orientation change (portrait → landscape → portrait).
- In landscape, scrollable content could not reach the bottom once the initial "height boost" was applied.

## Root Cause (Observed)
WKWebView reports an incorrect initial viewport height on first load. The height becomes correct only after a layout/rotation change. This caused the app's `100%` / `100vh`-style layouts to be sized too short until orientation changed.

## Fix Summary
We establish a single **app height** source of truth and force it to match the visual viewport on startup.

### Key ideas
- Use a CSS custom property `--app-height` for html/body sizing.
- On iOS, **briefly** allow a "boost" to `screen.height` in portrait to cover the initial gap.
- **Never** boost in landscape (prevents oversizing that blocks bottom scroll).
- Recompute on resize/orientation and during the first ~1.2s after launch.

## Implementation
### CSS
`app/src/index.css`
- Defines `--app-height`.
- Applies it to `html`, `body`, and `#root` to ensure a consistent 100% app height.
- Uses `100dvh` as a fallback where supported.

### JS
`app/src/main.tsx`
- `setupAppHeight()` sets `--app-height` to the best available viewport height:
  - `visualViewport.height`
  - `innerHeight`
  - `documentElement.clientHeight`
  - (iOS + portrait + brief settle window) `screen.height`
- Runs multiple passes immediately at startup + a short interval loop for iOS to "settle" the height.
- Listens to `resize`, `orientationchange`, and `visualViewport.resize`.

## Why This Works
The extra “settle” passes mimic the layout correction we used to get only after rotating the device, but now it happens immediately on first load. The portrait-only boost ensures the app fills the screen without creating an oversized container in landscape.

## Files Touched
- `app/src/index.css`
- `app/src/main.tsx`
- `app/src/components/PhotoGallery.tsx` (removed hardcoded `100dvh` so overlay follows the global height logic)

## Test Checklist
- iOS portrait, cold launch: **no bottom gap** in Calendar, Settings, Photo lightbox.
- iOS landscape: **scrollable areas reach bottom** (no clipped content).
- Rotate both directions: no regressions.
- Android + Desktop: no layout regressions.

## Notes
If you edit viewport logic, keep the portrait-only boost window short and ensure landscape uses the real visual viewport.
