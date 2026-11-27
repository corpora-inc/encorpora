/**
 * Standard hand signals: crane/content/tools/signals (Appendix A to Subpart
 * CC, public domain drawings and captions).
 */
import data from "../../../content/tools/signals/signals.json";

export interface Signal {
  signal_id: string;
  name: string;
  description: string;
  caption: string;
  svg: { path: string; width: number; height: number };
  kind: string;
  section_id: string;
  related_section_ids: string[];
  teaching_tip?: { text: string; verbatim: boolean };
}

const drawings = import.meta.glob("../../../content/tools/signals/svg/*.svg", { query: "?url", import: "default", eager: true }) as Record<string, string>;

export const SIGNALS: Signal[] = (data as unknown as { signals: Signal[] }).signals;
export const SIGNALS_SECTION = (data as unknown as { section_id: string }).section_id;

export function drawingUrl(s: Signal): string | null {
  return drawings[`../../../content/tools/signals/${s.svg.path}`] ?? null;
}

/** "RAISE THE BOOM AND LOWER THE LOAD" -> "Raise the boom and lower the load". */
export function displayName(s: Signal): string {
  const lower = s.name.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
