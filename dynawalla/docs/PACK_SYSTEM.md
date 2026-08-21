# Dynawalla — Pack system

**The pack system is the product's delivery mechanism** — reversed from this
document's previous position by the founder on 2026-07-26. See
[ADR-0020](DECISIONS/ADR-0020-content-packs-are-the-product.md), which supersedes
ADR-0003, and [ADR-0022](DECISIONS/ADR-0022-host-ships-no-content.md), which says
what is left in the host (nothing that is content).

> **What this file used to say, and why it is worth keeping in view.** It
> specified acceptance **by absence**: no catalog, no installer, no CDN, no URI
> scheme handler, no pack-related Tauri commands, verified by a release
> checklist. That is a set of gates which pass because a capability is missing,
> and they were all green while the app was an arithmetic drill nobody wanted to
> use. Everything below the fold — what Corpán's pack system already taught — was
> written for "whoever revives this". It is operative now.

## Where to start, and what not to build twice

This monorepo already ships a pack runtime. Read it before designing one:

- **`corpan/plugins/tauri-plugin-game-packs`** — the runtime, and the owner of
  the `corpan-pack://` URI scheme that serves every installed pack's assets.
- **`corpan/packs/sdk`** and **`corpan/packs/shared`** — the SDK a pack is built
  against and the libraries they share.
- **24 shipping packs**, four of them Babylon.js 3D worlds (`ad-world`,
  `corpan-city`, `hover-runner`, `juice-squeeze2`). Read how they boot, mount and
  dispose.
- **`corpan/packs/world-plaza/docs/GAME_DEV_PLAYBOOK.md`** — the hard-won lessons
  from the furthest game work in this repository.

Whether Dynawalla extends that plugin or gets a sibling is an open decision with
its own ADR to come. What is settled is that a second from-scratch runtime in one
repository is the outcome to avoid.

## The host side, which exists today

The host is a shell (ADR-0022) and already carries the two halves of the contract
an installer and a pack are built against:

- `dynawalla-app/src/packs/registry.ts` — the book of record: what is installed,
  at what version, at what digest, at what cost in bytes. An installer writes
  into it; the Packs destination reads out of it.
- `dynawalla-app/src/packs/host.ts` — the capability boundary. Everything a
  mounted pack is handed (the learner it is for, the device settings it must
  honour) and everything it can do (report one outcome). Forty lines, so that
  reviewing what a pack can reach is reading a file rather than auditing an app.

Not built yet, and named so nobody assumes otherwise: downloading, digest
verification, unpacking, the URI scheme handler, and the delivery origin.

## What Corpán's pack system already taught, for whoever builds this

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

## Where the artifacts live

The design starts from **signed, versioned, immutable artifacts on
S3/CloudFront**, not from a Pages object — the Pages artifact is whole-site, so
immutable versioned URLs are structurally unachievable there. That choice, the
catalog schema and the signing story each get an ADR when they are made.
