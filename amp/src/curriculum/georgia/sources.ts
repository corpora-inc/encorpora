import type { InventorySource } from "../source-reconciliation";

export const georgiaCase = "ga-k12-math-case-sy2023-2024";

const retrievedAt = "2026-11-04";
/**
 * Official CASE package for Georgia's K-12 Mathematics Standards. The hash
 * identifies the package bytes retrieved on the date above.
 */
export const georgiaSources: readonly InventorySource[] = [
  {
    id: georgiaCase,
    url: "https://case.georgiastandards.org/ims/case/v1p1/CFPackages/e9dd7229-3558-4df2-85c6-57b8938f6180",
    edition:
      "Georgia's K-12 Mathematics Standards (SY2023-2024), IMS CASE CFPackage e9dd7229-3558-4df2-85c6-57b8938f6180, adopted, last changed 2024-10-09, license CC BY-NC-SA",
    retrievedAt,
    sha256: "3f131db0f244ae74b10be5bb7d4e731844164599dbd3b042bb8aad4fc8ffe3fc",
  },
];
