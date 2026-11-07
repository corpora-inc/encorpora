import { useNavigate, useSearch } from "@tanstack/react-router";
import type { GridSort } from "../../../ui/DataGrid";
import { lesson, strands, studentById, terms, type TermId } from "./fixture";

export type PreviewSearch = {
  lone: boolean;
  term: TermId;
  student?: string;
  lesson?: string;
  lens: string;
  q: string;
  sort?: GridSort;
};

function parseSort(raw: unknown): GridSort | undefined {
  if (typeof raw !== "string") return undefined;
  const [column, direction] = raw.split(":");
  if (!column || (direction !== "ascending" && direction !== "descending"))
    return undefined;
  return { column, direction };
}

/** What the URL asks for. A malformed shared value recovers to the default
 * rather than replacing the screen with an error. */
export function readSearch(raw: Record<string, unknown>): PreviewSearch {
  const student =
    typeof raw.student === "string" ? studentById(raw.student)?.id : undefined;
  return {
    lone: raw.lone === 1 || raw.lone === "1",
    term: terms.find((term) => term.id === raw.term)?.id ?? "q2",
    student,
    lesson: raw.lesson === lesson.id ? lesson.id : undefined,
    lens: strands.some((strand) => strand.id === raw.lens)
      ? (raw.lens as string)
      : "overall",
    q: typeof raw.q === "string" ? raw.q.slice(0, 80) : "",
    sort: parseSort(raw.sort),
  };
}

/** The screen's state, kept in the URL: refresh, Back and shared links all
 * restore it. */
export function usePreviewSearch() {
  const raw = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const set = (
    patch: Record<string, string | number | undefined>,
    options: { replace?: boolean } = {},
  ) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        ...patch,
      })) as never,
      replace: options.replace,
      resetScroll: false,
    });
  return [readSearch(raw), set] as const;
}
