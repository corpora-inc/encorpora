import type { TemplateMetadata } from "../../../math/contracts";

export type TrialCatalog = {
  templates: TemplateMetadata[];
  skills: {
    id: string;
    title?: string;
    gradeBand: string;
    strand: string;
  }[];
};
