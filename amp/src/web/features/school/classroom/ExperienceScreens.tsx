import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Button } from "../../../ui/Button";
import { useStaffSession } from "../classes/api";
import { ClassFrame } from "../classes/ClassFrame";
import { PageHead } from "../parts";
import { experienceOptions, say } from "./api";
import { ExperienceSettings } from "./ExperienceSettings";
import styles from "../School.module.css";

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

/** What a class's students (or a family's children) see: a section of the
 * class's Settings (docs/design/ia.md, "Where settings live"), with what the
 * school has locked shown as locked. */
export function ClassExperienceSection({
  classId,
  family,
}: {
  classId: string;
  family: boolean;
}) {
  const session = useStaffSession();
  const scope = { kind: "class", id: classId } as const;
  const experience = useQuery(experienceOptions(session, scope));
  return (
    <section
      className={styles.settingsSection}
      aria-labelledby="class-experience"
    >
      <h2 id="class-experience">
        {family ? "What children see" : "Student experience"}
      </h2>
      <p className={styles.sectionLead}>
        The math stays the same whichever you choose.
      </p>
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
    </section>
  );
}

/** What a school or district decides for everyone: a section of its Settings
 * (docs/design/ia.md). */
export function OrgExperienceSection({ orgId }: { orgId: string }) {
  const session = useStaffSession();
  const scope = { kind: "org", id: orgId } as const;
  const experience = useQuery(experienceOptions(session, scope));
  return (
    <section
      className={styles.settingsSection}
      aria-labelledby="student-experience"
    >
      <h2 id="student-experience">Student experience</h2>
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
    </section>
  );
}
