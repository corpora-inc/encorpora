# ¡AHA!

An independent, local-first adaptive math tutor. Free2Z owns authentication, balance and metered inference; Corpora operates no app backend. Learner evidence stays in native SQLite; minimized learning context goes to Free2Z for teaching.

## Development

Use Node 24 and Rust 1.97.1. From `aha/aha-app`:

```sh
npm ci
npm test
npm run tsc
npm run build
npm run dev
```

Native commands once the native-shell task lands: `npm run tauri -- dev`, `npm run tauri -- android dev`, `npm run tauri -- ios dev`. Native prerequisites and real app registration are required; browser preview is not native/live acceptance.

See BUILD_STATUS.md for the issue queue and actual completion status. The standards graph and evidence model are independent of Dynawalla's adaptive engine.
