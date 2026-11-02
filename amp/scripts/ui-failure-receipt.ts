import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import { figureCapabilities } from "../src/math/contracts";
import { clientResponseCapabilities } from "../src/web/lib/batch-capability-fallback";

/** Never serialize a saved problem, account, request or response wholesale. */
export function publicUiFailureProblem(
  value: unknown,
  renderedId: string | null,
) {
  if (!value || typeof value !== "object" || !renderedId) return null;
  const p = value as Record<string, unknown>;
  if (
    p.id !== renderedId ||
    ![p.templateId, p.seed, p.prompt].every((v) => typeof v === "string")
  )
    return null;
  const response = p.response as { kind?: unknown } | undefined;
  return {
    id: renderedId,
    templateId: p.templateId as string,
    seed: p.seed as string,
    prompt: p.prompt as string,
    responseKind: typeof response?.kind === "string" ? response.kind : null,
  };
}

export async function captureUiFailure(
  page: Page,
  directory: string,
  phase: string,
  findPublicProblem: (id: string) => Promise<unknown>,
) {
  await mkdir(directory, { recursive: true });
  const geometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(".problem-content");
    const stage = document.querySelector<HTMLElement>(".problem-stage");
    const bounds = stage?.getBoundingClientRect();
    const contentLeft = bounds && stage ? bounds.left + stage.clientLeft : null;
    const contentRight =
      contentLeft !== null && stage ? contentLeft + stage.clientWidth : null;
    const overflowing =
      stage && bounds
        ? [...stage.querySelectorAll("*")].filter((element) => {
            const r = element.getBoundingClientRect();
            return (
              r.width > 0 && (r.left < contentLeft! || r.right > contentRight!)
            );
          })
        : [];
    return {
      renderedProblemId: content?.dataset.problemId ?? null,
      renderedTemplateId: content?.dataset.template ?? null,
      renderedPrompt:
        content?.querySelector(".question")?.getAttribute("data-text") ?? null,
      viewport: { width: innerWidth, height: innerHeight },
      theme: {
        explicit: document.documentElement.dataset.theme ?? null,
        prefersDark: matchMedia("(prefers-color-scheme: dark)").matches,
        colorScheme: getComputedStyle(document.documentElement).colorScheme,
      },
      stage: stage
        ? {
            rect: stage.getBoundingClientRect().toJSON(),
            clientWidth: stage.clientWidth,
            clientLeft: stage.clientLeft,
            contentLeft,
            contentRight,
            scrollWidth: stage.scrollWidth,
            clientHeight: stage.clientHeight,
            scrollHeight: stage.scrollHeight,
            scrollTop: stage.scrollTop,
            fontFamily: getComputedStyle(stage).fontFamily,
            scrollbarGutter: getComputedStyle(stage).scrollbarGutter,
          }
        : null,
      overflowingCount: overflowing.length,
      overflowing: overflowing.slice(0, 100).map((element) => ({
        tag: element.tagName,
        className: element.getAttribute("class"),
        rect: element.getBoundingClientRect().toJSON(),
      })),
    };
  });
  const receipt = {
    version: 1,
    phase,
    problem: null as ReturnType<typeof publicUiFailureProblem>,
    problemLookup: geometry.renderedProblemId ? "pending" : "not-rendered",
    capabilities: {
      response: [...clientResponseCapabilities],
      figure: [...figureCapabilities],
    },
    geometry,
  };
  await writeFile(
    join(directory, "failure.json"),
    JSON.stringify(receipt, null, 2) + "\n",
  );
  if (geometry.renderedProblemId) {
    try {
      const raw = await findPublicProblem(geometry.renderedProblemId);
      receipt.problem = publicUiFailureProblem(raw, geometry.renderedProblemId);
      receipt.problemLookup = receipt.problem ? "matched" : "unavailable";
    } catch {
      receipt.problemLookup = "failed";
    }
    await writeFile(
      join(directory, "failure.json"),
      JSON.stringify(receipt, null, 2) + "\n",
    );
  }
  // Crop to synthetic mathematical content; profiles and account chrome are excluded.
  if (geometry.stage)
    await page
      .locator(".problem-stage")
      .screenshot({ path: join(directory, "problem.png"), timeout: 3_000 });
}
