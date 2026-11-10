import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { OrgExperienceSection } from "./classroom/ExperienceScreens";
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
  const more = [
    can.has("privacy.read") && {
      path: "privacy",
      title: "Privacy and data",
      detail: "The data agreement, what AMP collects, export and deletion",
    },
    can.has("integrations.read") && {
      path: "integrations",
      title: "Integrations",
      detail: "Sign-in with Google or Microsoft, and rostering",
    },
  ].filter(Boolean) as { path: string; title: string; detail: string }[];
  return (
    <OrgFrame orgId={orgId} nav="settings" title="Settings">
      <div className={styles.settingsPage}>
        <PageHead title="Settings" detail={org?.name ?? " "} />
        {can.has("calendar.read") && <YearCalendar orgId={orgId} section />}
        {can.has("settings.read") && <OrgExperienceSection orgId={orgId} />}
        {can.has("license.read") && <LicenseSection orgId={orgId} />}
        {more.length > 0 && (
          <ul className={styles.settingsLinks}>
            {more.map((item) => (
              <li key={item.path}>
                <Link
                  to="/$"
                  params={{ _splat: orgPath(orgId, item.path) }}
                  className={styles.settingsLink}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <span className={styles.quiet}>{item.detail}</span>
                  </span>
                  <span aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </OrgFrame>
  );
}
