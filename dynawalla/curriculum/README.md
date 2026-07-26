# `dynawalla/curriculum` — the dev workspace

**The library moved.** It is
[`../packs/shared/curriculum`](../packs/shared/curriculum/README.md), where packs
import it from. Packs are the product; the host app ships no curriculum, so the
mathematics cannot live in a directory only the host can reach.

What is left here is the workspace that *runs* it: devDependencies, the
`tsconfig`, the `dw-curriculum` CLI and the commands. Nothing here ships.

```
npm ci
npm test                    # unit + property + boundary tests
npm run tsc                 # typecheck
npm run check               # dw-curriculum check — incremental, 200 seeds per level
npm run check:full          # the full sweep, 1000 seeds per level
npm run snapshots:update    # rewrite the CG-16 output hashes
```

The workspace stayed at this path deliberately: it is what CI's
`dynawalla-curriculum` job installs and runs from, and moving the commands as well
as the library would have taken the gates off a green trunk while the workflow —
which this track must not edit — still pointed here.

## `src/index.ts`

A compatibility re-export, and the only file left under `src/`. The host app's
`src/work/curriculum.ts` resolves `../../../curriculum/src/index.ts`; that file
belongs to the app track. Delete this directory when that seam is repointed at
`packs/shared/curriculum/src/index.ts`, or when the work surface moves into a pack.

## CI

The `dynawalla-curriculum` job's path filter is
`^(dynawalla/(curriculum|engine)/|…)`. It does **not** match
`dynawalla/packs/shared/`, so a PR that changes only the library does not yet run
the gates. Widening that filter is the one follow-up this move needs, and it lives
in `.github/workflows/ci.yml`.
