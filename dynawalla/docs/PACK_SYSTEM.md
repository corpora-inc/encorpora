# Dynawalla — Pack system

**There is no Dynawalla pack system in V1.** Curriculum is a compiled SQLite artifact
bundled in the app. See [ADR-0003](DECISIONS/ADR-0003-no-downloadable-packs-v1.md) and
[ADR-0012](DECISIONS/ADR-0012-ota-curriculum-deferral.md).

This document exists so that (a) the absence is verifiable rather than accidental, and
(b) whoever eventually builds one inherits what Corpán's pack system already learned
instead of rediscovering it.

## What "no pack system" means concretely

Acceptance is **by absence** (`K-01`, `K-02`, `K-03`):

- No catalog file, no catalog fetch, no catalog store.
- No installer, no install manager, no download UI, no progress surface.
- No CDN or S3 origin serving Dynawalla content.
- No custom URI scheme handler.
- No Rust pack runtime and no pack-related Tauri commands.
- The app makes **zero** network requests for curriculum content — asserted by a test and
  confirmed by a device network capture during the M7 device pass.

What replaces it: `dynawalla/curriculum/build/compile.ts` emits a deterministic
hash-stamped SQLite file into the app's `public/curriculum/`, bundled at build time. A
release-checklist gate asserts the shipped artifact's hash matches the compiled source
(`M-17`), and the artifact is capped at 12 MB.

## What this deletes from the critical path

A pack system is not a feature; it is a subsystem with its own failure modes. Declining
it removes, from V1:

- A from-scratch Rust pack runtime (Corpán's is ~2,900 lines inside `corpan_lib`, reached
  through eight Tauri commands) with connect and stall watchdogs and fail-closed sha256
  verification.
- A catalog surface, a CDN publishing path and an install manager.
- Three shared-TypeScript extraction waves that only exist to make the above reusable.
- Version skew between an installed pack and the host app, and the back-compat routing
  that manages it.
- On-device quota exhaustion.
- A second security boundary in a children's product.

## What Corpán's pack system already taught, for whoever revives this

Each of these cost something to learn. Read them before designing anything.

**The Pages artifact is whole-site.** `deploy-pages.yml` uploads `web/io/out` via
`upload-pages-artifact`, which atomically replaces everything at the site root, and no
pack ZIP is committed — every ZIP is produced from source at build time. Therefore
"build only the changed packs" 404s every unrebuilt pack the instant the artifact
publishes, and **immutable versioned URLs are structurally unachievable on a
source-rebuilt Pages site**: the artifact can only contain the version in the git tree.
Versioned artifacts must live on S3/CloudFront. See
[RELEASE_ENGINEERING.md](RELEASE_ENGINEERING.md).

**The ETag/304 "free poll" is off in production.** Every Corpán catalog policy sets
`skipConditionalGet: true` because CloudFront/Fastly reject the `If-None-Match` CORS
preflight. Do not plan polling capacity on conditional GET.

**Never change a published artifact in place.** Bump the version. A pack ZIP was once
swapped in place at the same version and produced two different SHAs for one version
number, which is unresolvable from the client side.

**A silent auto-install is a user-hostile download.** Never fetch content without asking:
show the size, show progress, and degrade gracefully if the user declines.

**Adding a catalog entry without a build step is a 404.** In Corpán, a pack listed in the
catalog but not built by the deploy workflow simply does not exist at its URL, and
nothing fails loudly.

**A pack's identifier surface is a public API.** `corpan-pack://` is baked into installed
packs' built JS on user devices; renaming the plugin that registers it breaks every
installed pack at runtime while compiling cleanly. Any URI scheme Dynawalla ever
registers inherits the same permanence.

**A delete path that is never registered leaks forever.** Corpán's install manager
invokes a `content_packs_delete` command that is not among the registered Tauri commands,
so uninstalled pack data stays on disk permanently. Whatever the runtime is, enumerate
the commands the frontend invokes and assert each one is registered.

## Trigger for building one

Both conditions together, per [ADR-0012](DECISIONS/ADR-0012-ota-curriculum-deferral.md):
an installed base large enough that an app-review cycle is a real cost to real users,
**and** a curriculum defect that cannot wait for a review cycle. Either alone is not a
trigger.

When it fires, the design starts from **signed, versioned, immutable artifacts on
S3/CloudFront**, not from a Pages object, and it gets its own ADR.
