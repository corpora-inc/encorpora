# journey-sim — the Journey engine's pre-ship simulation gate

Drives the REAL engine (`src/journey/engine/`) through its public API with
`createMemoryPersistence()` and a manual clock, per `corpan/docs/journey/specs/engine.md` §7.
No app build required; runs headless under node ≥ 22.

```bash
# full gate (25 learners/persona × 180 days × 7 personas) + W6 fixture-pack smoke
node --experimental-strip-types scripts/journey-sim/cli.ts --w6-smoke

# quick iteration
node --experimental-strip-types scripts/journey-sim/cli.ts --quick

# knobs
node --experimental-strip-types scripts/journey-sim/cli.ts \
  --learners 25 --days 180 --seed 1 --personas daily-median,lapser --out DIR
```

- `fixture.ts` — generated CourseGraph: 2 arcs × 12 units × 5 skills,
  ~1,800 items, 18 activity templates covering all forms/strands/modelNeeds,
  probe bank, substitutes, lesson recipes, unit bosses + arc gates, rare cards.
- `learner.ts` — §7.1 synthetic memory model (deliberately NOT FSRS) + the 7
  personas. Deterministic per (runSeed, persona, index).
- `runner.ts` — day-loop simulator; metrics accumulate incrementally.
- `report.ts` — P1–P11 gate evaluation. **P8 is DEFERRED by design (R10):
  placement quality must run against the real `journey_en` pack graph with
  personas scoped to shipped arcs before publish — a fixture-only P8 is not a
  valid pass.**
- `cli.ts` — entry point; writes `out/<run>/report.md` + `metrics.json`;
  exit code 1 on any failed gate. `--w6-smoke` loads the
  `dja/journey_pack/fixtures/dist/journey_en` pack through the in-tree
  `src/util/journeyPack.ts` loader (esbuild-bundled) and runs the engine on it.

Any engine-behavior PR (constants.ts, mixer, grading, scheduler config,
ts-fsrs bump) must attach a run (engine.md §7.4).
