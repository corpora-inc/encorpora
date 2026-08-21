# `dynawalla/packs/shared/`

Libraries that **packs** import. Packs are the product; the host app ships no
curriculum and no exercises. Anything a pack needs that is not that pack's own
idea lives here, in source form, imported through the `@shared` alias.

| Library | Import | What |
|---|---|---|
| `@dynawalla/curriculum` | `@shared/curriculum` | Exact-rational, seeded, deterministic mathematics: the skill graph, the generator families, the executable mal-rules, the solution walkthrough, the counting-board contrast pair, and the `CG-*` gates that validate all of them. |

The layout follows Corpán's `corpan/packs/shared/`, which is the same idea one
product over: per-library `package.json` for identity and version, a `CHANGELOG`
that names the consumers to rebuild, and **source** consumption rather than a
published artifact.

## How a pack consumes it

Build-time vendoring through a source alias. Two entries, no build step, no
registry:

```jsonc
// <pack>/tsconfig.json
{
  "compilerOptions": {
    "paths": { "@shared/*": ["../../shared/*"] }
  }
}
```

```ts
// <pack>/vite.config.ts
import { fileURLToPath } from "node:url"

export default defineConfig({
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("../shared", import.meta.url)) },
  },
})
```

```ts
import { columnOpFamily, countingBoard, rational } from "@shared/curriculum/src/index.ts"
```

Because it is vendored at build time, **changing a shared library does not change
an installed pack.** The consumer has to be rebuilt and republished, which is why
each library's CHANGELOG lists who that is.

## What a library here may and may not do

Asserted by `curriculum/src/boundary.test.ts`, which fails the build rather than
documenting an intention:

- **No import escapes the library.** Not into the app, not into `engine/`, not
  into a sibling.
- **No bare specifiers.** A pack must not have to resolve anything on our behalf,
  and a shared library must not silently claim a slot in a pack's `node_modules`.
- **No `node:` builtin on the runtime surface.** A pack runs in a WebView. The
  validator under `src/validate/` and the `*.test.ts` files are tooling, run under
  Node, and are never reached from a pack's import graph — the boundary test draws
  that line explicitly because it is invisible at runtime.
- **No DOM, no host globals.** Renderers are *declarations* here; drawing belongs
  to the pack. A library that touched the DOM would have started deciding what a
  pack looks like.
