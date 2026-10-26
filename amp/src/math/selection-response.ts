import type { MultiSelectResponse, ProblemResponse } from "./contracts";
import { normalizePointPlot, pointPlotAnswerText } from "./point-plot";
import { figureChoiceAnswerText } from "./figure-choice";

export const MAX_SELECTION_OPTIONS = 8;
export const MAX_SELECTION_RESPONSE_LENGTH = 200;
export const selectionIdPattern = /^option-[a-h]$/;

/** A draft may be empty or incomplete. Repeated or foreign-format IDs are invalid. */
export function parseSelection(raw: string): string[] | null {
  if (typeof raw !== "string" || raw.length > MAX_SELECTION_RESPONSE_LENGTH)
    return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      !Array.isArray(value) ||
      value.length > MAX_SELECTION_OPTIONS ||
      !value.every(
        (id) => typeof id === "string" && selectionIdPattern.test(id),
      ) ||
      new Set(value).size !== value.length
    )
      return null;
    return value as string[];
  } catch {
    return null;
  }
}

/** Selection order does not change the answer. Do not silently remove duplicates. */
export function serializeSelection(ids: readonly string[]): string {
  return JSON.stringify([...ids].sort());
}

export function canonicalSelection(raw: string): string | null {
  const ids = parseSelection(raw);
  return ids === null ? null : serializeSelection(ids);
}

/** Only a complete set of distinct displayed choices can be submitted. */
export function normalizeSelection(
  response: MultiSelectResponse,
  raw: string,
): string | null {
  const ids = parseSelection(raw);
  if (
    ids === null ||
    ids.length !== response.selectionCount ||
    !ids.every((id) => response.options.some((option) => option.id === id))
  )
    return null;
  return serializeSelection(ids);
}

/** Labels in display order, including incomplete drafts; never expose serialized IDs. */
export function responseAnswerLabels(
  response: ProblemResponse,
  raw: string,
): string[] | null {
  if (response.kind === "choice") {
    const option = response.options.find((option) => option.id === raw);
    return option ? [option.label] : null;
  }
  if (response.kind !== "multi-select") return null;
  const ids = parseSelection(raw);
  if (
    ids === null ||
    !ids.every((id) => response.options.some((o) => o.id === id))
  )
    return null;
  return response.options
    .filter((option) => ids.includes(option.id))
    .map((o) => o.label);
}

/** Keep complete sentences separate; use semicolons for short answer fragments. */
export function joinAnswerLabels(labels: readonly string[]): string {
  return labels.join(
    labels.every((label) => /[.!?]$/.test(label.trim())) ? " " : "; ",
  );
}

/** Completed worked answers are readable labels, never the transport format. */
export function answerText(response: ProblemResponse, raw: string): string {
  if (response.kind === "point-plot") {
    if (normalizePointPlot(response, raw) === null)
      throw new Error("Worked answer must place the required grid points");
    return pointPlotAnswerText(response, raw);
  }
  if (response.kind === "figure-choice")
    return figureChoiceAnswerText(response, raw);
  if (response.kind !== "choice" && response.kind !== "multi-select")
    return raw;
  if (
    response.kind === "multi-select" &&
    normalizeSelection(response, raw) === null
  )
    throw new Error("Worked answer must select the required displayed choices");
  const labels = responseAnswerLabels(response, raw);
  if (!labels?.length)
    throw new Error("Worked answer must reference a displayed choice");
  return joinAnswerLabels(labels);
}
