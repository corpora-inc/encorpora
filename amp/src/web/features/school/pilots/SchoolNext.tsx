import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { OrgResource } from "../../../../schools/contracts";
import type { AuthSession } from "../../../auth";
import { useLoggedError } from "../../../feedback";
import { linkRefused } from "../../../lib/link-carry";
import { Button, buttonClass } from "../../../ui/Button";
import { classesOptions, orgOptions, orgsOptions, school } from "../api";
import { forgetInvite, orgHome, rememberedInvite } from "../paths";
import { inviteToken, schoolState } from "./school-state";

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
  // An invitation kept on this device leads only while the server says it
  // is open; a used, expired or unknown one is dropped, and the account's
  // own next step shows instead.
  const [stored, setStored] = useState(() => rememberedInvite());
  const token = inviteToken(stored);
  const invite = useQuery({
    queryKey: ["school-invite", token ?? ""],
    enabled: !!token,
    retry: false,
    queryFn: () => school.lookupInvite(token!),
  });
  // Only the server's refusal (400/403/404/410, as the invitation screen
  // reads it) or its status ends an invitation; a failed request keeps it,
  // with a way to try again.
  const stale =
    !!token &&
    (linkRefused(invite.error) ||
      (!!invite.data && invite.data.status !== "open"));
  const unsure = !!token && invite.isError && !stale;
  useEffect(() => {
    if (!stale) return;
    forgetInvite();
    setStored(null);
  }, [stale]);
  const state =
    orgs.data && (!token || !invite.isPending)
      ? schoolState(orgs.data, token && invite.data && !stale ? stored : null)
      : null;
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
  const next = (() => {
    switch (state.kind) {
      case "invited":
        return (
          <div className={className} data-school-next="invited">
            <Link
              to={"/school/invite" as never}
              className={buttonClass("primary")}
            >
              {`Join ${invite.data?.orgName ?? "your school"}`}
            </Link>
          </div>
        );
      case "pending":
        return (
          <div className={className} data-school-next="pending">
            <p role="status">
              {state.org.name}’s admin is setting it up. It opens here once they
              finish.
            </p>
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
  })();
  if (!unsure) return next;
  return (
    <>
      {next}
      <p className={className} data-invite-retry="" role="status">
        Your invitation didn’t load.
        <Button
          variant="quiet"
          aria-busy={invite.isFetching || undefined}
          onClick={() => void invite.refetch()}
        >
          Try again
        </Button>
      </p>
    </>
  );
}
