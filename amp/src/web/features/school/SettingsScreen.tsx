import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { buttonClass } from "../../ui/Button";
import { OrgExperienceSection } from "./classroom/ExperienceScreens";
import { WeeklyTargetSection } from "./classroom/WeeklyTargetSection";
import { currentSession, orgOptions } from "./api";
import { YearCalendar } from "./CalendarScreen";
import { LicenseSection } from "./LicenseScreen";
import { OrgFrame } from "./OrgFrame";
import { PageHead } from "./parts";
import { orgPath } from "./paths";
import styles from "./School.module.css";

/**
 * `/school/$org/settings`: the one home of a school's or district's
 * configuration (docs/design/ia.md, "Where settings live"): the school year
 * and its terms, what students see, the license, then privacy and data and
 * integrations, which open as their own pages under this tab. A class's
 * Settings holds only that class's overrides.
 */
export function OrgSettingsScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const org = useQuery(orgOptions(currentSession(), orgId)).data;
  const can = new Set(org?.can ?? []);
  return (
    <OrgFrame orgId={orgId} nav="settings" title="Settings">
      <div className={styles.settingsPage}>
        <PageHead title="Settings" />
        {can.has("calendar.read") && <YearCalendar orgId={orgId} section />}
        {can.has("settings.read") && org?.kind !== "family" && (
          <WeeklyTargetSection orgId={orgId} />
        )}
        {can.has("settings.read") && <OrgExperienceSection orgId={orgId} />}
        {can.has("license.read") && <LicenseSection orgId={orgId} />}
        {org && !org.demo && org.kind !== "family" && (
          <section>
            <h2>School connections</h2>
            <Link
              to="/$"
              params={{ _splat: "school/connect" }}
              className={buttonClass("secondary")}
            >
              Connect a school roster
            </Link>
            <Link
              to="/$"
              params={{ _splat: "school/adopt" }}
              className={buttonClass("quiet")}
            >
              Bring an existing school into a district
            </Link>
          </section>
        )}
        {/* Privacy and Integrations are the sub-tabs above, not links here. */}
      </div>
    </OrgFrame>
  );
}
