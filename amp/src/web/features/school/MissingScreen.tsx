import { Link, useParams } from "@tanstack/react-router";
import { buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { ClassFrame } from "./classes/ClassFrame";
import { OrgFrame } from "./OrgFrame";

/** An address inside a school or a class that no screen answers (an old or
 * mistyped link): it says so in the place's own frame and leads to the
 * place's first screen, never to another screen's content. */
export function SchoolMissingScreen() {
  const params = useParams({ strict: false }) as {
    org: string;
    class?: string;
  };
  const body = (open: string, to: string) => (
    <EmptyState
      title="This page isn’t here"
      action={
        <Link to={to as never} className={buttonClass("primary")}>
          {open}
        </Link>
      }
    >
      Its address may be old or mistyped.
    </EmptyState>
  );
  if (params.class)
    return (
      <ClassFrame
        org={params.org}
        classId={params.class}
        loading={false}
        tab=""
      >
        {body(
          "Open Today",
          `/school/${params.org}/classes/${params.class}/today`,
        )}
      </ClassFrame>
    );
  return (
    <OrgFrame orgId={params.org} nav="overview" title="Not found">
      {body("Open the school", `/school/${params.org}`)}
    </OrgFrame>
  );
}
