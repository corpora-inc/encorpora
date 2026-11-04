import type { InventorySource } from "../source-reconciliation";

export const arizonaGrade4 = "az-math-grade4-2016";

const retrievedAt = "2026-11-04";
/**
 * Official grade-4 standards file. azed.gov returned HTTP 403 to an automated
 * fetch on the retrieval date. The hash is the Internet Archive capture
 * 20260314061525 of that same URL (398,845-byte PDF), not a live 200 body.
 */
export const arizonaSources: readonly InventorySource[] = [
  {
    id: arizonaGrade4,
    url: "https://www.azed.gov/sites/default/files/2025/03/Math%20Grade%204%20Final%202025.pdf",
    edition:
      "Arizona Mathematics Standards, grade 4, adopted December 2016, file updated 1-29-2025. Direct fetch from azed.gov returned HTTP 403 on 2026-11-04. Hashed bytes are Internet Archive capture 20260314061525 of this URL.",
    retrievedAt,
    sha256: "7c77dd1c0fdac5382a5d4a84166b115f0e6f515e8ddb73cc11208f2b2713b6f1",
  },
];
