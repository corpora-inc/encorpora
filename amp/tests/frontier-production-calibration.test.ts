import assert from "node:assert/strict";
import test from "node:test";
import {
  CALIBRATION_SEED,
  runProductionCalibration,
} from "../scripts/frontier/production-calibration";

/** Misspecified coverage after sd-cal-v1, on the seeded population that
 * fixed the constants. Quick mode keeps that whole grid (a 40-learner draw
 * misses ±4 by sampling error) and still finishes in under a minute. */
const MAE_AT_100 = 0.7;

test(
  "reported sd covers the misspecified production learner",
  { timeout: 60_000 },
  async () => {
    const started = Date.now();
    const report = await runProductionCalibration({
      seed: CALIBRATION_SEED,
      quick: true,
      models: ["misspecified"],
      quiet: true,
    });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 60_000, `harness took ${elapsed}ms`);
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
