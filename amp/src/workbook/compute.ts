import { lessons } from "../content/lessons.js";
import { skills } from "../curriculum/catalog.js";
import { templates } from "../math/engine.js";
import { composeWorkbook, type WorkbookSpec } from "./compose.js";
import { workbookHtml, type WorkbookHtmlOptions } from "./render.js";

export type ComposeInput = Omit<
  Parameters<typeof composeWorkbook>[0],
  "templates" | "skills" | "lessons"
>;
export type HtmlInput = { spec: WorkbookSpec } & Pick<
  WorkbookHtmlOptions,
  "learnerName" | "paper" | "results"
>;

const skillTitle = (id: string) => skills.find((s) => s.id === id)?.title ?? id;

/** The CPU-heavy workbook steps, as plain data in and out, so they give the same
 * result on any thread. */
export const computeWorkbook = {
  compose: (input: ComposeInput): WorkbookSpec =>
    composeWorkbook({ ...input, templates, skills, lessons }),
  html: ({ spec, ...options }: HtmlInput): string =>
    workbookHtml(spec, { ...options, lessons, skillTitle }),
};
export type WorkbookTask = keyof typeof computeWorkbook;
