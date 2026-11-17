import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatDay } from "../../../../schools/calendar";
import { Button, buttonClass } from "../../../ui/Button";
import { calendarOptions, orgOptions } from "../../school/api";
import { EditSheet } from "../../school/CalendarScreen";
import { GradingPeriods } from "../Records";
import type { FamilyPlace } from "../FamilyFrame";
import styles from "../Family.module.css";

/**
 * Settings › School year. The one-section SchoolYearSection (the IA v2 spec,
 * §3.4, its own package) replaces both parts below when it lands: the dates
 * and the grading periods, with one edit.
 */
export function SchoolYearPart({ place }: { place: FamilyPlace }) {
  const data = place.data;
  if (!data) return null;
  return (
    <>
      <LegacySchoolYear place={place} />
      {place.own &&
        data.children.some((child) => child.capabilities.readGrades) && (
          <GradingPeriods place={place} shared={!!data.teachingPlace} />
        )}
    </>
  );
}

/** The family's school year: its dates, and changing them. No terms or
 * grading periods: a family's records run the whole year. */
function LegacySchoolYear({ place }: { place: FamilyPlace }) {
  const { session } = place;
  // The class's own org: a family's id need not be it.
  const orgId = place.own?.org ?? "";
  const org = useQuery({
    ...orgOptions(session, orgId),
    enabled: !!place.own,
  });
  const calendar = useQuery({
    ...calendarOptions(session, orgId),
    enabled: !!place.own && !!org.data?.can?.includes("calendar.read"),
  });
  const [editing, setEditing] = useState(false);
  const year = calendar.data?.find((entry) => entry.kind === "year");
  if (!place.own || !org.data?.can?.includes("calendar.read")) return null;
  // The year is the class's: with other families' children in it, it is
  // the tutoring group's to change, where that scope is said.
  const shared = !!place.data?.teachingPlace;
  const canEdit = !shared && !!org.data.can.includes("calendar.write");
  return (
    <section className={styles.section} aria-labelledby="family-year">
      <h2 id="family-year">School year</h2>
      <dl className={styles.settings}>
        <div className={styles.setting}>
          <div className={styles.settingText}>
            <dt>{year?.name ?? " "}</dt>
            <dd>
              {year
                ? `${formatDay(year.startsOn)} to ${formatDay(year.endsOn)}`
                : calendar.isError
                  ? "The year didn’t load."
                  : " "}
            </dd>
          </div>
          <div className={styles.settingAction}>
            {calendar.isError ? (
              <Button
                variant="secondary"
                onClick={() => void calendar.refetch()}
              >
                Try again
              </Button>
            ) : (
              canEdit &&
              year && (
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Change dates
                </Button>
              )
            )}
          </div>
        </div>
      </dl>
      <p className={styles.footnote}>
        {shared
          ? "Your tutoring group shares these dates."
          : "Report cards and time count from the first day."}
      </p>
      {shared && org.data.can.includes("calendar.write") && (
        <Link
          to="/$"
          params={{
            _splat: `school/${place.own.org}/classes/${place.own.id}/settings`,
          }}
          className={buttonClass("secondary")}
          style={{ justifySelf: "start" }}
          data-group-calendar=""
        >
          Open the group’s calendar
        </Link>
      )}
      {editing && year && !shared && (
        <EditSheet
          orgId={orgId}
          session={year}
          onClose={() => setEditing(false)}
        />
      )}
    </section>
  );
}
