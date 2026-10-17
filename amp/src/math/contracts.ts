/** Reference templates demonstrate selected skills; they are not a complete curriculum. */
export type SemanticFigure =
  | { kind: 'collection'; count: number }
  | { kind: 'fraction'; selected: number; parts: number }
  | { kind: 'rectangle'; width: number; height: number; unit: 'cm' }
  | { kind: 'right-triangle'; a: number; b: number; unit: 'cm' }
  | { kind: 'dataset'; values: number[] };
export interface TemplateMetadata {
  id: string;
  version: 1;
  title: string;
  skillId: string;
  gradeBand: 'K–2' | '3–5' | '6–8' | '9–12';
  description: string;
}
export interface PublicProblem {
  id: string;
  templateId: string;
  templateVersion: 1;
  seed: string;
  prompt: string;
  skillId: string;
  response: { kind: 'number' | 'fraction'; label: string };
  figure?: SemanticFigure;
}
/** Keep this object on the grading side; send only `public` before an attempt. */
export interface GeneratedProblem {
  public: PublicProblem;
  answer: string;
  explanation: string[];
  hint: string;
}
