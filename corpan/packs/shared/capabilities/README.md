# Capability modules

Reusable experience guts — mounted in-process by the owning pack, Journey
cards, and pop-in sheets:

    mount(container, hostApi, spec: ActivitySpec)
      → { result: Promise<ActivityResult>, pause, resume, dispose }

Spec: `corpan/docs/journey/specs/capability-modules.md`. The activity
contract types are the SYNCED copy of
`corpan-app/src/contentPacks/activityContract.ts` (refresh with
`node packs/sdk/sync-contract.mjs`; CI drift-checks with `--check`).

| Module | Import | Extracted from | CSS prefix |
|---|---|---|---|
| cap-pronounce | `@shared/capabilities/pronounce` | pronunciation-coach | `capPron-` |
| cap-squeeze | `@shared/capabilities/squeeze` | juice-squeeze | `capSqz-` |
| cap-segment-player | `@shared/capabilities/segment-player` | earthgate-reader | `capSeg-` |

Consumption is the `@shared` source alias (build-time vendoring): a pack adds
tsconfig `paths` + vite `resolve.alias` entries and imports; changing a
capability requires rebuilding + republishing consumer packs to propagate
(each capability's CHANGELOG lists consumers to rebuild).

cap-squeeze is React internally; `react`, `react-dom`, `@dnd-kit/core` and
`zustand` are bare imports resolved from the CONSUMER's node_modules — a
non-React consumer must add those deps and pays the §2.5 budget.

## Dev

    npm install            # this directory (test/harness deps only)
    npm test               # contract suites + unit tests + smoke (jsdom)
    npm run smoke          # the mount→complete→settle smoke alone
    npm run lint:css       # §2.4 prefix/viewport-unit lint
    npm run size           # §2.5 min+gzip budgets (probe bundles)
    npm run harness:pronounce        # bare harness on 0.0.0.0:5199
    npm run harness:squeeze          #   → http://spark-f62c:5199/
    npm run harness:segment-player

Rules (§2.4/§3.2): no Tailwind, one owned CSS prefix per module,
container-relative only (no viewport units / fixed / safe-area env),
`core` never imports a capability, capabilities import only `core` +
`packs/shared/*` + declared deps, nothing here imports from `corpan-app/`
or any pack.
