/// <reference types="vite/client" />
// Brings in Vite's ambient module declarations — notably `*?worker&inline`
// (used by src/world/facadePainter.ts to inline the façade painter worker as a
// Blob so it loads in the embedded host's `/packs`, not as a separate file).
