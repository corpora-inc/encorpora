import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { OrgResource } from "../../../../schools/contracts";
import type { AuthSession } from "../../../auth";
import { useLoggedError } from "../../../feedback";
import { Button, buttonClass } from "../../../ui/Button";
import { classesOptions, orgOptions, orgsOptions, school } from "../api";
import { orgHome, rememberedInvite } from "../paths";

/** What an account already has at a school, read from its places: the next
 * step for each is different (docs/architecture/spaces.md, "School first
 * runs"). A demo is something to explore, never an institution. */
export type SchoolState =
  | { kind: "invited"; token: string }
  | { kind: "setup"; org: OrgResource }
  | { kind: "admin"; org: OrgResource }
  | { kind: "teacher"; org: OrgResource }
  | { kind: "none"; demo: OrgResource | null };

const real = (org: OrgResource) => !org.demo && org.kind !== "family";

export function schoolState(
  orgs: readonly OrgResource[],
  invite: string | null,
): SchoolState {
  const token = invite?.replace(/^#/, "").split(".")[0] ?? "";
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) return { kind: "invited", token };
  const mine = orgs.filter(real);
  const setup = mine.find(
    (org) => org.setupPending && org.roles.includes("admin"),
  );
  if (setup) return { kind: "setup", org: setup };
  const admin = mine.find(
    (org) => org.roles.includes("admin") || org.roles.includes("viewer"),
  );
  if (admin) return { kind: "admin", org: admin };
  const teacher = mine.find((org) => org.roles.length > 0);
  if (teacher) return { kind: "teacher", org: teacher };
  return {
    kind: "none",
    demo: orgs.find((org) => org.demo && org.kind !== "family") ?? null,
  };
}

/**
 * The school answer's next step, by what this account already has
 * (SPEC R11): an invitation on this device opens it; a school to finish
 * setting up continues its setup; a school they run opens; a teacher's own
 * pilot opens their class, with the buyer handoff beside it; and someone
 * with none starts with their class today, explores the demo, or talks to
 * us below. Clever is offered only where it is turned on.
 */
export function SchoolNext({
  session,
  clever,
  exploring,
  onExplore,
  className,
}: {
  session: AuthSession;
  /** The row the buttons sit in. */
  className?: string;
  clever: boolean;
  exploring: boolean;
  onExplore: () => void;
}) {
  const orgs = useQuery(orgsOptions(session));
  useLoggedError(orgs.isError ? "Your schools didn’t load." : "");
  const state = orgs.data ? schoolState(orgs.data, rememberedInvite()) : null;
  const invite = useQuery({
    queryKey: ["school-invite", state?.kind === "invited" ? state.token : ""],
    enabled: state?.kind === "invited",
    retry: false,
    queryFn: () =>
      school.lookupInvite(state?.kind === "invited" ? state.token : ""),
  });
  const teacherOrg = state?.kind === "teacher" ? state.org.id : null;
  // Which of its classes this teacher teaches: the org's own read says.
  const teacherAt = useQuery({
    ...orgOptions(session, teacherOrg ?? ""),
    enabled: !!teacherOrg,
  });
  const classes = useQuery({
    ...classesOptions(session, teacherOrg ?? ""),
    enabled: !!teacherOrg,
  });
  // The buttons' row is there from the first paint and keeps its height.
  const waiting = !!teacherOrg && (teacherAt.isPending || classes.isPending);
  if (!state || orgs.isError || waiting)
    return (
      <div
        className={className}
        data-school-next="loading"
        aria-busy={!orgs.isError || waiting || undefined}
      >
        {orgs.isError && !waiting ? (
          <>
            <Button
              variant="primary"
              aria-busy={orgs.isFetching || undefined}
              onClick={() => void orgs.refetch()}
            >
              Try again
            </Button>
            <span role="alert">Your schools didn’t load.</span>
          </>
        ) : (
          <>
            <span className={`amp-skeleton ${buttonClass("primary")}`}>
              Start with your class
            </span>
            <span className={`amp-skeleton ${buttonClass("secondary")}`}>
              Explore a demo school
            </span>
          </>
        )}
      </div>
    );
  const open = (org: OrgResource, label: string) => {
    const home = orgHome(org);
    return (
      <Link
        to={home.to as never}
        search={("search" in home ? home.search : {}) as never}
        className={buttonClass("primary")}
      >
        {label}
      </Link>
    );
  };
  const cleverLink = clever && (
    <Link to="/school/connect" className={buttonClass("secondary")}>
      Use Clever
    </Link>
  );
  switch (state.kind) {
    case "invited":
      return (
        <div className={className} data-school-next="invited">
          <Link
            to={"/school/invite" as never}
            className={buttonClass("primary")}
          >
            {invite.data?.status === "open"
              ? `Join ${invite.data.orgName}`
              : "Open your invitation"}
          </Link>
        </div>
      );
    case "setup":
      return (
        <div className={className} data-school-next="setup">
          {open(state.org, `Finish setting up ${state.org.name}`)}
        </div>
      );
    case "admin":
      return (
        <div className={className} data-school-next="admin">
          {open(state.org, `Open ${state.org.name}`)}
          {cleverLink}
        </div>
      );
    case "teacher": {
      const mine =
        classes.data?.find((klass) =>
          teacherAt.data?.teaches?.includes(klass.id),
        ) ?? null;
      return (
        <div className={className} data-school-next="teacher">
          {open(
            state.org,
            mine ? `Open ${mine.name}` : `Open ${state.org.name}`,
          )}
          {/* The whole school pays from the class: the buyer's link carries
              the class's records, so nothing is imported twice. */}
          {mine && (
            <Link
              to={`/school/${state.org.id}/classes/${mine.id}/today` as never}
              search={{ seats: 1 } as never}
              className={buttonClass("secondary")}
            >
              Send to your school’s buyer
            </Link>
          )}
        </div>
      );
    }
    default:
      return (
        <div className={className} data-school-next="none">
          <Link to="/school/start" className={buttonClass("primary")}>
            Start with your class
          </Link>
          {state.demo ? (
            <Link
              to={`/school/${state.demo.id}` as never}
              className={buttonClass("secondary")}
            >
              Open the demo school
            </Link>
          ) : (
            <Button
              variant="secondary"
              aria-busy={exploring || undefined}
              disabled={exploring}
              onClick={onExplore}
            >
              Explore a demo school
            </Button>
          )}
          {cleverLink}
        </div>
      );
  }
}
