/// <reference types="vite/client" />

// Audio assets imported as ES modules so VITE resolves their URL correctly for
// the pack origin (corpan-pack:// when installed) — the URL that fetch() can load.
declare module "*.wav" {
  const src: string
  export default src
}
