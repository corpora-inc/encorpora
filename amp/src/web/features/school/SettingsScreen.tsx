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
        {/* A district brings in schools that already use AMP; the school
            approves from the link (docs/schools.md). */}
        {org?.kind === "district" && can.has("schools.add") && (
          <section
            className={styles.settingsSection}
            aria-labelledby="settings-schools"
          >
            <h2 id="settings-schools">Schools</h2>
            <div>
              <Link
                to="/school/adopt"
                search={{ district: orgId, manage: 1 }}
                className={buttonClass("secondary")}
              >
                Invite a school
              </Link>
            </div>
          </section>
        )}
        {/* Privacy and Integrations are the sub-tabs above, not links here. */}
      </div>
    </OrgFrame>
  );
}
