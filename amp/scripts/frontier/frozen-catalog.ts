import { readFileSync } from "node:fs";
import {
  describeSimulationCatalog,
  type SimulationDataset,
} from "./simulation";
import type { EditorialCalibration } from "../../src/learning/item-calibration";

/** The editorial overrides as reviewed against the frozen catalog's own
 * generators. They stay with the fixture: a later rewrite of a live generator
 * (multiply-facts in #1173) retires its live entry, not this one. */
export const frozenEditorialCalibration: EditorialCalibration = {
  "count-objects@1": { offset: -0.1, discrimination: 1.8 },
  "multiply-facts@1": { offset: -0.1, discrimination: 1.8 },
  "linear-equation@1": { offset: 0.1, discrimination: 1.6 },
  "divide-fractions@1": { offset: 0.1, discrimination: 1.6 },
};

/** A trusted local regression fixture. Its fingerprint identifies inputs, not
 * estimator/selector policy; those are the code under test. Its editorial
 * calibration describes its generators and travels with it. */
export function loadFrozenCatalog(): SimulationDataset & {
  sourceCommit: string;
  sourceCatalogSha256: string;
} {
  const dataset = JSON.parse(
    readFileSync(
      new URL("../../tests/fixtures/frontier-catalog-v1.json", import.meta.url),
      "utf8",
    ),
  );
  if (
    dataset.sourceCommit !== "a163bce4b44001bd5c662b743c079a5c8872d139" ||
    dataset.sourceCatalogSha256 !==
      "805d2be8c8c27f24c7a587ec8d813a91c5466997bcfaf261dd953f57af22fbc8" ||
    describeSimulationCatalog(dataset).sha256 !==
      "aa57b327d416c7353acafa1579a6d3db0d25f75e489ef9aafce63deef604aa4c"
  )
    throw new Error(
      "Frozen catalog identity changed; review and version the experiment",
    );
  return { ...dataset, calibration: frozenEditorialCalibration };
}
