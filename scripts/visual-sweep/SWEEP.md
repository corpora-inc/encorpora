# Visual / device sweep

A deliberately **thin** human practice that shrinks over time. It is **not a merge
gate** — nothing here blocks the queue. It exists to catch the small set of things
machines don't yet judge well: visual regressions and real on-device install/launch
flows. The goal is to automate more of it (real-device cloud is a later spike) so the
human fraction trends toward 0.

## Attach visual evidence to a PR (any worker)

```bash
# one-time
npm i -D playwright && npx playwright install chromium

# capture phone/tablet/desktop screenshots of a running build
node scripts/visual-sweep/screenshot.mjs http://localhost:5173 --out /tmp/shots
# multiple routes, full-page
node scripts/visual-sweep/screenshot.mjs \
  http://localhost:5173/ http://localhost:5173/packs --out /tmp/shots --full
```

Drag the PNGs into the PR description or a comment as before/after evidence. For
remote review (user on Tailscale), serve the shots dir on `0.0.0.0` and share the
`http://spark-f62c:PORT/` URL — never `localhost`.

## The periodic `needs-human` sweep

Some issues genuinely need eyes or hardware. Tag them `needs-human` and leave them in
the queue. Periodically (cadence by judgment — when the pile is non-trivial, not on a
cron), a human drains the pile:

1. `gh issue list --label needs-human` to see the pile.
2. For each: run the relevant build, capture screenshots with the script above, and —
   where it's a device-specific flow — install on a real iOS/Android device and walk
   the browse → install → launch → offline-play path.
3. Fix forward with a normal small squash PR through the usual gates, or, if it's
   genuinely fine, close the issue with the evidence attached.
4. If a class of `needs-human` checks becomes mechanizable, automate it and delete that
   reason from this list. Prune this doc as that fraction shrinks.

## What does NOT belong here

Correctness, security, and pack back-compat are machine gates (`ci-gate`,
`adversarial-review`, `hygiene`) — not human-sweep work. If something keeps landing in
`needs-human` that a gate could catch, strengthen the gate instead.
