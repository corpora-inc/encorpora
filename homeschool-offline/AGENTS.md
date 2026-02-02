# Agent Notes (Homeschool Offline)

- iOS viewport height is handled via `--app-height` in `app/src/index.css` and `setupAppHeight()` in `app/src/main.tsx`.
- Keep the portrait-only boost window short; never boost in landscape or it will block bottom scrolling.
- If you change viewport logic, re-test iOS cold launch in portrait + landscape and the Photo lightbox.
