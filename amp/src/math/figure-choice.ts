import { z } from "zod";
import { sceneSchema, type Scene } from "./scene/spec";

/** The figure-choice protocol (`figure-choice-v1`).
 *
 * A single choice whose options are figures: small graphs or number lines
 * drawn with the scene framework. Each option carries its scene and a text
 * description written from the same model as the figure, so a screen reader
 * can tell the options apart without seeing them. Option ids name positions
 * (`option-a` is the first card); the generator shuffles the options, so an
 * id says nothing about correctness. The answer is the correct option's id
 * and stays on the server until the attempt is graded. */
export const MIN_FIGURE_OPTIONS = 2;
export const MAX_FIGURE_OPTIONS = 4;
/** The widest and tallest an option figure may lay out. Cards draw it at
 * this size, so its 15 px labels never shrink below the legible 12 px. */
export const FIGURE_OPTION_MAX_WIDTH = 280;
export const FIGURE_OPTION_MAX_HEIGHT = 300;
export const figureChoiceNouns = ["Graph", "Number line"] as const;
export type FigureChoiceNoun = (typeof figureChoiceNouns)[number];
export const figureOptionIds = [
  "option-a",
  "option-b",
  "option-c",
  "option-d",
] as const;
export const figureOptionLetters = ["A", "B", "C", "D"] as const;

export interface FigureChoiceOption {
  id: string;
  /** Plain-text description of the figure, read by screen readers and
   * printed in answer keys. It describes what is drawn, never whether the
   * figure is correct. */
  label: string;
  scene: Scene;
}
export interface FigureChoiceResponse {
  kind: "figure-choice";
  /** The instruction, such as "Choose the graph". */
  label: string;
  /** What each option is called: "Graph B", "Number line C". */
  noun: FigureChoiceNoun;
  options: FigureChoiceOption[];
}

const optionSchema = z
  .object({
    id: z.enum(figureOptionIds),
    label: z.string().trim().min(10).max(240),
    scene: sceneSchema,
  })
  .strict();
export const figureChoiceResponseSchema = z
  .object({
    kind: z.literal("figure-choice"),
    label: z.string().trim().min(1).max(200),
    noun: z.enum(figureChoiceNouns),
    options: z
      .array(optionSchema)
      .min(MIN_FIGURE_OPTIONS)
      .max(MAX_FIGURE_OPTIONS),
  })
  .strict()
  .refine(
    (r) =>
      r.options.every((o, i) => o.id === figureOptionIds[i]) &&
      new Set(r.options.map((o) => o.label)).size === r.options.length &&
      new Set(r.options.map((o) => JSON.stringify(o.scene.elements))).size ===
        r.options.length &&
      // A title, note or walkthrough could name or single out an option; the
      // card's letter and description are its only names.
      r.options.every(
        (o) =>
          o.scene.title === undefined &&
          o.scene.note === undefined &&
          o.scene.steps === undefined &&
          (o.scene.width ?? 360) <= FIGURE_OPTION_MAX_WIDTH &&
          (o.scene.maxHeight ?? 320) <= FIGURE_OPTION_MAX_HEIGHT,
      ),
    "Figure options are lettered in order, with distinct descriptions and figures, untitled and card-sized",
  );

/** Only a displayed option's id can be submitted. */
export function normalizeFigureChoice(
  response: FigureChoiceResponse,
  raw: string,
): string | null {
  return typeof raw === "string" && response.options.some((o) => o.id === raw)
    ? raw
    : null;
}
export function gradeFigureChoice(
  response: FigureChoiceResponse,
  answer: string,
  raw: string,
): boolean {
  return (
    normalizeFigureChoice(response, raw) !== null &&
    normalizeFigureChoice(response, answer) === raw
  );
}
/** "B" for the second option; null for an id that is not displayed. */
export function figureChoiceLetter(
  response: FigureChoiceResponse,
  id: string,
): string | null {
  const at = response.options.findIndex((o) => o.id === id);
  return at < 0 ? null : figureOptionLetters[at]!;
}
/** "Graph B", for the feedback line and the answer key. */
export function figureChoiceName(
  response: FigureChoiceResponse,
  id: string,
): string | null {
  const letter = figureChoiceLetter(response, id);
  return letter ? `${response.noun} ${letter}` : null;
}
/** The worked answer in words: the chosen figure's description, which a
 * lesson shows beside that figure alone. */
export function figureChoiceAnswerText(
  response: FigureChoiceResponse,
  raw: string,
): string {
  const option = response.options.find((o) => o.id === raw);
  if (!option) throw new Error("Worked answer must name a displayed figure");
  return option.label;
}
/** One option among those shown. */
export const figureChoiceGuessChance = (response: FigureChoiceResponse) =>
  1 / response.options.length;
/** The review marks: which card is correct and which the learner chose. */
export function figureChoiceReview(
  response: FigureChoiceResponse,
  answer: string,
  chosen: string,
): { correct: string | null; chosen: string | null } {
  return {
    correct: normalizeFigureChoice(response, answer),
    chosen: normalizeFigureChoice(response, chosen),
  };
}
