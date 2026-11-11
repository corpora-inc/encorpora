import assert from "node:assert/strict";
import test from "node:test";
import {
  CALIBRATION_SEED,
  runProductionCalibration,
} from "../scripts/frontier/production-calibration";

/** Misspecified coverage after sd-cal-v1, on the seeded population that
 * fixed the constants. Quick mode keeps that whole grid (a 40-learner draw
 * misses ±4 by sampling error). */
const MAE_AT_100 = 0.7;
/** The harness's own work, in CPU time across its worker threads: about
 * 310 s measured on 2026-11-11, so a budget half again over it catches a
 * slower harness. Wall time is no measure of that: the suite runs this beside
 * every other test file, and the machine may be shared, so the wall-clock
 * limit below only guards against a hang. */
const CPU_BUDGET_MS = 450_000;

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
      const { coverage1, coverage2, n } = band.reported;
      assert.ok(n >= 100, `${label}: n=${n}`);
      assert.ok(
        coverage1 >= 0.64 && coverage1 <= 0.72,
        `${label}: ±1σ ${(coverage1 * 100).toFixed(1)}%`,
      );
      assert.ok(
        coverage2 >= 0.92 && coverage2 <= 0.98,
        `${label}: ±2σ ${(coverage2 * 100).toFixed(1)}%`,
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
