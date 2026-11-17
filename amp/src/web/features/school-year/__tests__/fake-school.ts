import { splitYear, type DivisionKind } from "../../../../schools/calendar";
import type { SessionResource } from "../../../../schools/setup-contracts";

/* The school routes a school year reads and writes, as the server answers
 * them (src/schools/setup.ts `updateSession`, roster.ts `updateClass` with
 * its `ensureDivision`). Synthetic ids only. */

export const ORG = "00000000-0000-4000-8000-0000000000a1";
export const CLASS = "00000000-0000-4000-8000-0000000000c1";
export const YEAR = "00000000-0000-4000-8000-0000000000e1";

export type Call = { path: string; body: unknown };

export function fakeSchool() {
  let next = 0;
  const state = {
    calls: [] as Call[],
    can: ["calendar.read", "calendar.write", "classes.update"] as string[],
    gradingKind: "year" as string,
    sessions: [
      {
        id: YEAR,
        parentId: null,
        kind: "year",
        name: "2026–27",
        startsOn: "2026-07-01",
        endsOn: "2027-06-30",
        inherited: false,
      },
    ] as SessionResource[],
    /** A write that answers with a failure. */
    refuse: null as RegExp | null,
  };
  const year = () => state.sessions.find((s) => s.kind === "year")!;
  async function handle(path: string, body: unknown): Promise<unknown> {
    state.calls.push({ path, body });
    if (body !== undefined && state.refuse?.test(path))
      throw new Error("refused");
    const route = path.replace(`/school/orgs/${ORG}`, "");
    if (route === "")
      return {
        org: {
          id: ORG,
          kind: "family",
          name: "The family",
          parentId: null,
          timezone: "America/Chicago",
          roles: [],
          can: state.can,
        },
      };
    if (route === "/calendar")
      return { sessions: structuredClone(state.sessions) };
    if (route.startsWith("/classes?"))
      return {
        classes: [
          {
            id: CLASS,
            orgId: ORG,
            sessionId: YEAR,
            name: "Family",
            courseBands: [],
            gradingKind: state.gradingKind,
            joinCode: "ABCDEF",
            studentCount: 2,
          },
        ],
      };
    const session = /^\/calendar\/sessions\/(.+)$/.exec(route);
    if (session) {
      const found = state.sessions.find((s) => s.id === session[1]);
      Object.assign(found!, body);
      return {};
    }
    if (route === `/classes/${CLASS}`) {
      const kind = (body as { gradingKind: string }).gradingKind;
      state.gradingKind = kind;
      if (
        kind !== "year" &&
        !state.sessions.some((s) => s.kind === kind && s.parentId === YEAR)
      )
        for (const part of splitYear(
          year().startsOn,
          year().endsOn,
          kind as DivisionKind,
        ))
          state.sessions.push({
            ...part,
            id: `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
            parentId: YEAR,
            kind: kind as DivisionKind,
            inherited: false,
          });
      return {};
    }
    throw new Error(`No fake route for ${path}`);
  }
  return { state, handle };
}
