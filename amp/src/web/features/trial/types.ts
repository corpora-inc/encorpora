import type { TemplateMetadata } from "../../../math/contracts";

export type TrialCatalog = {
  trial?: { free: number; placement: number };
  templates: TemplateMetadata[];
  skills: {
    id: string;
    title?: string;
    description?: string;
    prerequisites?: string[];
    gradeBand: string;
    strand: string;
  }[];
};
