import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import type { AuthSession } from "../../auth";
import { useLearningView } from "../../lib/learning-view";
import { Button, buttonClass } from "../../ui/Button";
import { childAddress } from "../spaces/identity";
import { familyOptions } from "../family/api";
import { useHandOver } from "../school/classes/today/use-hand-over";
import type { PracticeFilter } from "./curriculum-filter";

export function PracticeLabel() {
  return (
    <>
      Practice <span aria-hidden="true">›</span>
    </>
  );
}

/** A learner's own session starts directly. A parent browsing a child's
 * curriculum starts that child directly, keeping their record distinct. */
export function CurriculumPractice({ filter }: { filter: PracticeFilter }) {
  const location = useLocation();
  const child = childAddress(location.pathname);
  const view = useLearningView({ records: false });
  if (child && view.session.data) {
    return (
      <FamilyPractice
        child={child}
        session={view.session.data}
        filter={filter}
      />
    );
  }
  // A class record is not permission to answer as one of its students.
  if (
    child ||
    location.pathname.startsWith("/school/") ||
    !view.canPractice ||
    view.viewOnly
  )
    return null;
  return (
    <Link
      to="/$"
      params={{ _splat: "practice" }}
      search={filter}
      className={buttonClass("primary")}
      data-curriculum-practice
    >
      <PracticeLabel />
    </Link>
  );
}

function FamilyPractice({
  child,
  session,
  filter,
}: {
  child: NonNullable<ReturnType<typeof childAddress>>;
  session: AuthSession;
  filter: PracticeFilter;
}) {
  const location = useLocation();
  const family = useQuery(familyOptions(session, child.family));
  const { handOver, starting, error } = useHandOver(session);
  const learner = family.data?.children.find(
    (entry) => entry.id === child.learner,
  );
  if (!learner?.capabilities.practiceHere || !learner.access.canPractice)
    return null;
  return (
    <div data-curriculum-practice>
      <Button
        variant="primary"
        aria-label={`Practice with ${learner.name}`}
        aria-busy={!!starting || undefined}
        onClick={() => {
          if (!starting) void handOver(learner.id, filter, location.href);
        }}
      >
        <PracticeLabel />
      </Button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
