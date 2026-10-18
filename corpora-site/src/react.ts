import { createRequire } from "node:module";
import type * as ReactAPI from "react";
import type * as ServerAPI from "react-dom/server";

// Use AMP's runtime for both its shared components and the static renderer.
// Two independently installed React copies break shared components using hooks.
const requireAmp = createRequire(
  new URL("../../amp/package.json", import.meta.url),
);
const React = requireAmp("react") as typeof ReactAPI;
export const { renderToStaticMarkup } = requireAmp(
  "react-dom/server",
) as typeof ServerAPI;
// tsx's Node-only classic-JSX fallback also handles AMP components that normally
// use Vite's automatic JSX transform. No runtime from this adapter is shipped.
(globalThis as typeof globalThis & { React: typeof ReactAPI }).React = React;
export default React;
