# ADR-0012 — Curriculum ships bundled; OTA deferred with a stated trigger

**Status:** Accepted
**Related:** [ADR-0003](ADR-0003-no-downloadable-packs-v1.md)

## Context

Curriculum content changes more often than app code. That is the usual argument for
over-the-air delivery. It is a good argument once there is an installed base, and a bad
one before there is.

## Decision

V1 compiles the curriculum graph to a deterministic hash-stamped SQLite artifact bundled
in the app. There is no OTA path, no catalog and no CDN surface. A release-checklist gate
asserts the artifact hash matches the compiled source (`M-17`).

## Trigger for revisiting

Both conditions, together:

1. There is an installed base large enough that an app-review cycle is a real cost — i.e.
   users who would be affected by waiting.
2. A curriculum defect exists that **cannot wait for a review cycle** — a wrong answer
   accepted, a wrong answer rejected, or content that is wrong in a child's own
   classroom.

Either condition alone is not a trigger. Condition 2 without condition 1 is fixed by
shipping a release. Condition 1 without condition 2 is a convenience argument.

## Consequences of the deferral

- A curriculum fix requires an app release, which is a 1–3 day path through both stores
  plus review time. That is acceptable at V1.
- The bundled artifact must stay small: `M-17` caps it at 12 MB, and `Q-03` requires the
  app to cold-launch to a first problem in under 2.5 s on the Galaxy Tab A9.
- Skill ids are immutable regardless (see
  [ADR-0006](ADR-0006-typed-ts-curriculum-exact-arithmetic.md)) because they are mastery
  keys on learner devices. Bundling does not relax that.

## If the trigger fires

Design it as **signed, versioned, immutable artifacts on the S3/CloudFront path this
repo already operates** — not as GitHub Pages objects. Pages serves a whole-site
artifact that atomically replaces everything, so the previous version's URL disappears on
the next deploy; immutable URLs are structurally unachievable there
([RISKS.md](../RISKS.md) R-13). And note that Corpán's catalog policies set
`skipConditionalGet: true` because CloudFront/Fastly reject the `If-None-Match` CORS
preflight — the ETag/304 "free poll" is off in production. Do not plan capacity on it.
