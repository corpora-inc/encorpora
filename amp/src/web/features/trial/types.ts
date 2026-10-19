import type { TemplateMetadata } from "../../../math/contracts";

export type TrialCatalog = {
  trial?: { free: number; placement: number };
  templates: TemplateMetadata[];
  skills: {
    id: string;
    title?: string;
    gradeBand: string;
    strand: string;
  }[];
};
