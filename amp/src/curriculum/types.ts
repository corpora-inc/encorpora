/** Published content and assessment readiness are separate from catalog inclusion. */
export type CoverageStatus = "planned" | "implemented" | "verified";
export type GradeBand =
  | "K"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "algebra-1"
  | "geometry"
  | "algebra-2"
  | "precalculus";
export interface Standard {
  id: string;
  framework: "CCSS" | "SAT";
  description: string;
  sourceUrl: string;
  sourceReviewedAt: string;
  scope: "standard" | "domain";
  /** Official (+) designation for additional high-school mathematics. */
  advanced?: boolean;
}
export interface Skill {
  id: string;
  title: string;
  description: string;
  gradeBand: GradeBand;
  strand: string;
  prerequisites: string[];
  prerequisiteBasis: "editorial";
  alignments: { standardId: string; facet: string; basis: "editorial" }[];
  facets: { id: string; description: string; status: CoverageStatus }[];
  status: CoverageStatus;
  /** Stable publishing association; existence here does not mean a lesson is published. */
  lessonId: string;
}
