import {
  curriculumSummaryResource,
  parentViewResource,
  scopeResource,
  type CurriculumSummary,
  type ParentView,
  type ScopeAndSequence,
} from "../../../schools/share-contracts";
import { AppError } from "../../lib/AppError";
import { request } from "../../lib/api";

export const SCOPE_PDF = "/api/v1/schools/scope-and-sequence.pdf";
export const SCOPE_CSV = "/api/v1/schools/scope-and-sequence.csv";

/** The live counts `/schools` leads with, loaded before it paints so the page
 * appears once, whole. Without them the page still reads; it says no numbers. */
export async function loadCurriculum(): Promise<CurriculumSummary | null> {
  try {
    return await request("/schools/curriculum", curriculumSummaryResource);
  } catch (error) {
    console.error("The curriculum counts didn’t load", error);
    return null;
  }
}
export async function loadScope(): Promise<ScopeAndSequence | null> {
  try {
    return await request("/schools/scope-and-sequence", scopeResource);
  } catch (error) {
    console.error("The scope and sequence didn’t load", error);
    return null;
  }
}

/** The link no longer shows anything: it was revoked, it expired, or the
 * student has left. Everything else is worth trying again. */
export class LinkEnded extends Error {}
const failure = () =>
  new AppError(
    "unavailable",
    "This page didn’t load. Check your connection and try again.",
    true,
  );

/** Not the shared `request`: this page has no sign-in to end and reports
 * nothing about how it went. Only a token travels, in the body. */
export async function readParentView(token: string): Promise<ParentView> {
  let response: Response;
  try {
    response = await fetch("/api/v1/school/share/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      referrerPolicy: "no-referrer",
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    console.error("The progress page didn’t load", error);
    throw failure();
  }
  if (response.status === 410 || response.status === 400) throw new LinkEnded();
  if (!response.ok) {
    console.error("The progress page didn’t load", response.status);
    throw failure();
  }
  return parentViewResource.parse(await response.json());
}

export const shareErrorMessage = (error: unknown, fallback: string) =>
  error instanceof AppError && error.message ? error.message : fallback;
