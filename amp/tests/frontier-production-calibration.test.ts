import assert from "node:assert/strict";
import test from "node:test";
import {
  CALIBRATION_SEED,
  runProductionCalibration,
} from "../scripts/frontier/production-calibration";

/** Misspecified coverage as shown (sd-cal-v2: the shown level, and the
 * reported width for each estimate's own answer count), on the seeded
 * population that, with early-anchor seed 1, fixed the constants. A
 * reproducibility check, not the calibration's evidence: that is the
 * validation on other seeds in docs/adaptive-evidence.md. Quick mode keeps
 * the whole grid (a 40-learner draw misses by sampling error). */
const MAE_AT_100 = 0.7;
/** The harness's own work, in CPU time across its worker threads: about
 * 310 s on a developer Mac and 473 s on a GitHub ubuntu runner (2026-11-11),
 * so the budget is about twice the slowest machine's: it catches a harness
 * that doubles its work, not a slower CPU. Wall time is no measure of that:
 * the suite runs this beside every other test file, and the machine may be
 * shared, so the wall-clock limit below only guards against a hang. */
const CPU_BUDGET_MS = 900_000;

test(
  "reported sd covers the misspecified production learner",
  { timeout: 600_000 },
  async () => {
    const started = process.cpuUsage();
    const report = await runProductionCalibration({
      seed: CALIBRATION_SEED,
      quick: true,
      models: ["misspecified"],
      quiet: true,
    });
    const used = process.cpuUsage(started);
    const cpu = Math.round((used.user + used.system) / 1000);
    assert.ok(cpu < CPU_BUDGET_MS, `harness used ${cpu}ms of CPU`);
    const bands = report.models.misspecified.bands.filter(
      (band) => band.scope === "overall" || band.scope === "strands",
    );
    assert.equal(bands.length, 8);
    for (const band of bands) {
      const label = `${band.scope} at ${band.answers}`;
      const { coverageShown, n } = band.reported;
      assert.ok(n >= 100, `${label}: n=${n}`);
      // The range the app draws, ±1.64 reported sd, aims at 90%.
      assert.ok(
        coverageShown >= 0.85 && coverageShown <= 0.96,
        `${label}: ±1.64σ ${(coverageShown * 100).toFixed(1)}%`,
      );
    }
    const at100 = bands.find(
      (band) => band.answers === 100 && band.scope === "overall",
    )!;
    assert.ok(
      at100.reported.mae <= MAE_AT_100,
      `MAE at 100 answers is ${at100.reported.mae.toFixed(3)}`,
    );
  },
);
