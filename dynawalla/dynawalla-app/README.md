# dynawalla-app

The Tauri 2 shell for **Dynawalla: Apprentice of Numbers** — bundle
`inc.corpora.dynawalla`.

Program docs live in [`../docs/`](../docs/README.md); the architecture this tree
implements is [ARCHITECTURE.md](../docs/ARCHITECTURE.md) and the routing and
capability decisions are [ADR-0005](../docs/DECISIONS/ADR-0005-shell-and-routing.md).

## Commands

Node 24 (`.nvmrc`).

| | |
|---|---|
| `npm run dev` | Vite dev server on `127.0.0.1:1423` (Corpán holds 1421) |
| `npm run tauri dev` | the desktop app against that dev server |
| `npm test` | `node --experimental-strip-types --test` — no vitest |
| `npm run tsc` | typecheck: the app, the tests, and the build's own config |
| `npm run lint` | eslint |
| `npm run build` | production bundle |
| `npm run drive:schemas` | drives every answer schema and representation in a real browser, and measures what it drew (needs `npm run dev`) |
| `node tools/drive-locate.mjs` | drives the practice loop to the Stage-2 contrast pair |

Three tsconfigs, because they need different globals. `tsconfig.json` is browser
source with **no Node types** — with them in scope a component can write
`process.env.X`, typecheck, and then throw in the WebView, since Vite shims no
`process` in a production build. `tsconfig.test.json` adds them back for the
tests, which read files. `tsconfig.node.json` covers `vite.config.ts` and
`eslint.config.js`; `npm run tsc` runs all three, because `tsc --noEmit` does
not build project references and a `references` entry would check nothing.

CI runs lint, test, tsc and build in the `dynawalla-app` job, which reports into
`ci-gate`. There is **no cargo job for either app in `ci.yml`** — the Rust below
is not compiled by any required check yet.

## Layout

```
src/
  app/        shell, router, theme, the native boundary
  design/     tokens and the primitives built directly on them
  screens/    one module per route
  work/       the practice loop: entry models, judging, the answer surfaces
  preview/    the renderer bench — development only, not in the bundle
src-tauri/    its own Cargo workspace root, its own Cargo.lock
```

`src/app/routes.ts` is the single route table. `src/app/strings.ts` is every
user-visible string in one place, ahead of the i18n gate in PR-1.6.

## The renderer bench

`preview.html` mounts `src/preview/`: every `AnswerSchema` and every
representation, drawn from a real schema and driven by the real entry model, on
one page. **Not** a route and **not** in the shipped bundle — `vite build` inputs
`index.html` and nothing else — but under `src/` so `npm run tsc` and
`npm run lint` cover it.

CG-8 is bidirectional, and a renderer nobody has drawn is a renderer nobody has
checked. Three bugs were found by looking at this page: a phantom answer rule
above the column grid, a mark row half a cell off its digits, and a balance beam
that swung off its own fulcrum. `npm run drive:schemas` drives it headlessly and
photographs it in both themes at 320 px and 390 px.

**Looking is not enough, so the driver measures.** A balance beam tipping the
wrong way is legible in a screenshot and was still missed in one; the driver now
reads `getBoundingClientRect()` off the drawn pans and fails when the heavier one
is not the lower one, reads the number line's index as a fraction of the rule and
fails when it is not standing on its own tick, presses the arrow keys at the
choice group and fails when focus does not move, and re-runs every target-size
check at 320 px, where the cells are smallest. A regex over a component cannot
express any of those, and `representation.test.ts` — which is regex over source —
had asserted only that the two beam angles were mirror images, which the inverted
pair satisfies exactly as well as the correct one.

## Design tokens

[`src/design/tokens.css`](src/design/tokens.css) is three layers: a palette of
materials, a semantic layer that names roles and resolves them to materials
(re-cut under `.dw-dark`), and a Tailwind `@theme inline` block that republishes
the semantic layer as utilities. Colour literals are legal only in the palette;
`tokens.test.ts` fails the build on one anywhere else, on a semantic token with
no dark counterpart, on a motion duration that `prefers-reduced-motion` does not
collapse, and on a component that names a material instead of a role —
`bg-parchment-50` compiles, contains no hex, and does not re-cut in dark, which
is the same silent failure by a different route.

The theme is applied at module load by a store subscription toggling one class
on `<html>` (ADR-0005) — importing `src/app/theme.ts` is what applies it, which
is why `main.tsx` imports it first.

## Capabilities

The permission surface is deliberately minimal, because a shipped app cannot
narrow it later without breaking installed clients.

| Grant | Command | Why |
|---|---|---|
| `core:app:allow-version` | `getVersion()` | The settings screen shows the installed build — the first thing a parent reporting a problem is asked for. |

That is the whole list. No plugin is registered and no `<plugin>:default` grant
exists (ADR-0005 point 4, acceptance item `X-07`). The CSP is non-null, has no
wildcard, admits no remote origin, and admits no inline style — which is why no
component may set a `style` attribute; a test holds those two together.

Every native call is declared in [`src/app/permissions.ts`](src/app/permissions.ts).
`src/app/capabilities.test.ts` asserts the declared calls and the granted
permissions are the same set **in both directions**, so a new native import
without a grant fails, and a grant nothing uses fails too. The scan covers the
whole `@tauri-apps` scope — plugins are `@tauri-apps/plugin-*`, not
`@tauri-apps/api` — and every import form, including `await import(...)`; a
guard that quietly misses the case it was written for is worse than none, so
the scanner itself is tested against each form.

## Native

`src-tauri/Cargo.toml` has no `[workspace]` section and must never gain one.
It is its own implicit workspace root, exactly like Corpán's. Read
[ADR-0011](../docs/DECISIONS/ADR-0011-native-workspace-and-patch-placement.md)
before touching any Cargo manifest here — a `[patch.crates-io]` moved to a
shared root is ignored silently and reverts Corpán to an `ndk-context` that
aborts on Android Activity recreation, compiling and testing clean all the way
to the Play Console.

`src-tauri/icons/icon.png` is a geometric placeholder pending the art pass,
regenerated by `tools/make-icon.py` rather than committed as an opaque blob.
Two constraints on it, both asserted by `capabilities.test.ts` because both
otherwise surface minutes into a Rust build:

- It must be PNG **colour type 6 (RGBA)**. `tauri::generate_context!` decodes it
  and panics `icon ... is not RGBA` on anything else. The alpha channel is
  entirely opaque and carries nothing, but it must be there. Downstream the iOS
  AppIcon asset must *not* carry one (App Store validation rejects it,
  ITMS-90717) and `tauri icon` emits RGBA for that set too — flattening it
  belongs with the iOS target.
- `*.png` is **Git LFS** repo-wide, so a checkout without the object leaves a
  pointer file that `generate_context!` will happily try to decode. Any job that
  compiles the Rust needs the LFS object — `ci.yml` fetches that one path.
