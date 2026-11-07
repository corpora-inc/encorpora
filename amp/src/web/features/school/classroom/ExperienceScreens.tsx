import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Button } from "../../../ui/Button";
import { useStaffSession } from "../classes/api";
import { ClassFrame } from "../classes/ClassFrame";
import { OrgFrame } from "../OrgFrame";
import { PageHead } from "../parts";
import { experienceOptions, say } from "./api";
import { ExperienceSettings } from "./ExperienceSettings";

/** `.../classes/$class/experience`: this class's own choices. */
export function ClassExperienceScreen() {
  const params = useParams({ from: "/school/$org/classes/$class/experience" });
  const session = useStaffSession();
  const scope = { kind: "class", id: params.class } as const;
  const experience = useQuery(experienceOptions(session, scope));
  return (
    <ClassFrame
      org={params.org}
      classId={params.class}
      className={experience.data?.scope.name}
      loading={experience.isPending}
      tab="experience"
    >
      <PageHead
        title="Student experience"
        detail="What students in this class see. The math they practice is the same either way."
      />
      {experience.data ? (
        <ExperienceSettings
          session={session}
          scope={scope}
          experience={experience.data}
        />
      ) : (
        <EmptyState
          title="These settings didn’t load"
          action={
            <Button variant="primary" onClick={() => void experience.refetch()}>
              Try again
            </Button>
          }
        >
          {say(experience.error, "The settings didn’t load.")}
        </EmptyState>
      )}
    </ClassFrame>
  );
}

/** `/school/$org/experience`: what a school or district decides for everyone. */
export function OrgExperienceScreen() {
  const params = useParams({ strict: false }) as { org: string };
  const session = useStaffSession();
  const scope = { kind: "org", id: params.org } as const;
  const experience = useQuery(experienceOptions(session, scope));
  return (
    <OrgFrame orgId={params.org} nav="experience" title="Student experience">
      <PageHead
        title="Student experience"
        detail="What students see unless a class chooses otherwise. Lock a setting to decide it for everyone below."
      />
      {experience.data ? (
        <ExperienceSettings
          session={session}
          scope={scope}
          experience={experience.data}
        />
      ) : experience.isPending ? (
        <Loading>Loading these settings…</Loading>
      ) : (
        <EmptyState
          title="These settings didn’t load"
          action={
            <Button variant="primary" onClick={() => void experience.refetch()}>
              Try again
            </Button>
          }
        >
          {say(experience.error, "The settings didn’t load.")}
        </EmptyState>
      )}
    </OrgFrame>
  );
}
