import type { InventorySource } from "../source-reconciliation";

export const floridaBest = "fl-best-math-2025";
export const floridaPage = "fl-fldoe-math-page";
export const floridaAlgebra2 = "fl-course-algebra-2";
export const floridaPrecalculus = "fl-course-precalculus-honors";

const retrievedAt = "2026-10-26";
/**
 * Official sources. The FLDOE mathematics page links the standards PDF hosted
 * by CPALMS; course descriptions are FLDOE files. Hashes identify the bytes
 * retrieved on the date above, not verification of every claim.
 */
export const floridaSources: readonly InventorySource[] = [
  {
    id: floridaBest,
    url: "https://cpalmsmediaprod.blob.core.windows.net/uploads/docs/standards/best/ma/mathbeststandardsfinal.pdf",
    edition:
      "Florida's B.E.S.T. Standards for Mathematics (K-12), 234-page PDF dated July 2025",
    retrievedAt,
    sha256: "8767ed58e5c5b94992c444391c217f6ce121f03a36007deba0566ed3d7e0b0fc",
  },
  {
    id: floridaPage,
    url: "https://cdn.fldoe.org/academics/standards/subject-areas/math-science/mathematics/",
    edition:
      "FLDOE B.E.S.T. Standards for Mathematics page (adoption and links)",
    retrievedAt,
    sha256: "ee263b1369be7a08eff5c519529b4d913fafcbce18e914cf9e029e1ee2f0e66e",
  },
  {
    id: floridaAlgebra2,
    url: "https://cdn.fldoe.org/core/fileparse.php/7576/urlt/Algebra-2.pdf",
    edition: "FLDOE course description, Algebra 2 (course 1200330)",
    retrievedAt,
    sha256: "383d0c09ad85e2095c03b0804a178f07c9927e93d3f961b10085359eeefae05a",
  },
  {
    id: floridaPrecalculus,
    url: "https://cdn.fldoe.org/core/fileparse.php/7576/urlt/PrecalcHonors.pdf",
    edition: "FLDOE course description, Precalculus Honors (course 1202340)",
    retrievedAt,
    sha256: "c72e6001924d8a3ea213e1d25b3a3afeb4fa7e688f0650f4075256b481dc1a25",
  },
];
