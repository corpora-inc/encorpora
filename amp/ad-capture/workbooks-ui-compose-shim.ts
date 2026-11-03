/**
 * The real composer, with two fixture substitutions for the ad capture:
 * the learner key (seed namespace) maps the fixture's UUID to the editor's
 * key "third-grade", and `now` is the editor's clock (2026-11-02T15:00Z),
 * so the API composes exactly the workbooks the editor printed as PDFs.
 * Everything else (evidence, history, choices, numbering) comes from the
 * real route.
 */
import * as real from "../src/workbook/compose.ts";
export * from "../src/workbook/compose.ts";
type Options = Parameters<typeof real.composeWorkbook>[0];
const config = () =>
  (globalThis as any).__workbooksUiCompose as
    | { keys: Record<string, string>; now: number; calls: unknown[] }
    | undefined;
export function composeWorkbook(options: Options) {
  const c = config();
  if (!c) return real.composeWorkbook(options);
  const learnerKey = c.keys[options.learnerKey] ?? options.learnerKey;
  c.calls.push({ from: options.learnerKey, learnerKey, date: options.date, number: options.number, minutes: options.minutes, history: options.history?.length ?? 0 });
  return real.composeWorkbook({ ...options, learnerKey, now: c.now });
}
