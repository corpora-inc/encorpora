import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { signOut } from "../../auth";
import { meOptions } from "../../lib/query";
import { Avatar } from "../../ui/Avatar";
import { AppError } from "../../lib/AppError";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Menu, MenuItem, MenuLabel } from "../../ui/Menu";
import type { TabItem } from "../../ui/Tabs";
import { classesOptions, currentSession, orgOptions, orgsOptions } from "./api";
import { classPath, orgPath } from "./paths";
import { compareClassNames } from "./sort";
import { PlaceSwitcher, placeEntries } from "../navigation/PlaceSwitcher";
import {
  SchoolFrame,
  type SchoolCrumb,
  type SchoolNavSection,
} from "./SchoolFrame";
import styles from "./School.module.css";

const VISIBLE_CLASSES = 8;
const VISIBLE_CLASSES_TAUGHT = 4;
export type NavId =
  | "overview"
  | "schools"
  | "integrations"
  | "privacy"
  | "activity"
  | "classes"
  | "students"
  | "staff"
  | "calendar"
  | "import"
  | "license"
  | "sign-in-help"
  | "experience"
  | "family"
  | `class:${string}`;

/** The signed-in person at the foot of a rail: their address and Sign out. */
export function AccountMenu() {
  const session = currentSession();
  const me = useQuery(meOptions(session)).data;
  const email = me?.signedIn ? (me.account.email ?? "") : "";
  return (
    <Menu
      align="start"
      triggerClassName={styles.accountTrigger}
      aria-label="Account"
      label={
        <span className={styles.accountLabel}>
          <Avatar name={email || "Account"} size="small" />
          <span>Account</span>
        </span>
      }
    >
      {email && <MenuLabel>{email}</MenuLabel>}
      <MenuItem
        onSelect={() =>
          void signOut().catch((error) => {
            console.error("Sign out did not finish", error);
          })
        }
      >
        Sign out
      </MenuItem>
    </Menu>
  );
}

/** Where this person is, and the way to their other places: the shared place
 * switcher when there's more than one, otherwise the school's name. */
function OrgSwitcher({
  current,
  name,
  ancestors,
}: {
  current: string;
  name: string;
  ancestors: readonly { id: string }[];
}) {
  const session = currentSession();
  const me = useQuery(meOptions(session)).data;
  const orgs = useQuery(orgsOptions(session)).data ?? [];
  const navigate = useNavigate();
  if (me?.signedIn && placeEntries(me).length > 1) {
    // A family's class is their family side; a school inside a district this
    // person works for is that place.
    const mine =
      me.familyClass?.orgId === current
        ? ("home" as const)
        : [current, ...ancestors.map((entry) => entry.id).reverse()]
            .map((id) => `school:${id}` as const)
            .find((id) =>
              me.staffOf?.some((org) => `school:${org.orgId}` === id),
            );
    return <PlaceSwitcher me={me} current={mine ?? null} label={name} />;
  }
  if (orgs.length < 2) return <p className={styles.orgName}>{name}</p>;
  return (
    <Menu align="start" label={name}>
      <MenuLabel>Your schools</MenuLabel>
      {orgs.map((org) => (
        <MenuItem
          key={org.id}
          disabled={org.id === current}
          onSelect={() =>
            void navigate({
              to: "/$",
              params: { _splat: orgPath(org.id, "classes") },
            })
          }
        >
          {org.name}
        </MenuItem>
      ))}
    </Menu>
  );
}

/** The real staff frame around every screen in a school. What it lists is what
 * this person can do: a teacher never sees a link that would come back empty,
 * and "Just my class" collapses the school around the one class. */
export function OrgFrame({
  orgId,
  nav,
  title,
  crumbs = [],
  tabs,
  activeTab,
  children,
}: {
  orgId: string;
  nav: NavId;
  title: string;
  crumbs?: readonly SchoolCrumb[];
  /** A class's screens, under the breadcrumb. */
  tabs?: readonly TabItem[];
  activeTab?: string;
  children: ReactNode;
}) {
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId));
  const classes = [
    ...(useQuery(classesOptions(session, orgId)).data ?? []),
  ].sort((a, b) => compareClassNames(a.name, b.name));
  const me = useQuery(meOptions(session)).data;
  const elsewhere = !!me?.signedIn && placeEntries(me).length > 1;
  if (!org.data) {
    // Not found says so; anything else is this request, and trying again works.
    const missing =
      !(org.error instanceof AppError) || org.error.status === 404;
    return (
      <div className={styles.lost} data-dense>
        {missing ? (
          <EmptyState
            title="This school isn’t available to your account"
            action={
              <Link to={"/school" as never} className={buttonClass("primary")}>
                Open your schools
              </Link>
            }
          >
            If someone sent you this link, ask them to invite this account, or
            sign in with the address they invited.
          </EmptyState>
        ) : (
          <EmptyState
            title="This school didn’t load"
            action={
              <Button variant="primary" onClick={() => void org.refetch()}>
                Try again
              </Button>
            }
          >
            {org.error?.message}
          </EmptyState>
        )}
      </div>
    );
  }
  const can = new Set(org.data.can ?? []);
  const lone = org.data.solo === true && classes.length <= 1;
  const isSchool = org.data.kind === "school";
  // A family's class: its children are the roster, and their access, consent
  // and privacy live on the family's own screens.
  const family = org.data.kind === "family";
  const admin = (id: NavId, label: string, path: string, action: string) =>
    can.has(action as never) ? [{ id, label, path: orgPath(orgId, path) }] : [];
  const schoolItems = [
    ...(family
      ? []
      : [
          {
            id: "students",
            label: "Students",
            path: orgPath(orgId, "students"),
          },
        ]),
    ...admin("staff", "Staff", "staff", "staff.read"),
    { id: "calendar", label: "Calendar", path: orgPath(orgId, "calendar") },
    {
      id: "experience",
      label: "Student experience",
      path: orgPath(orgId, "experience"),
    },
    ...(isSchool ? admin("import", "Import", "import", "roster.import") : []),
    ...admin("license", "License", "license", "license.read"),
    ...(family ? [{ id: "family", label: "Family", path: "family" }] : []),
  ];
  const recordItems = [
    ...admin(
      "integrations",
      "Integrations",
      "integrations",
      "integrations.read",
    ),
    ...admin("privacy", "Privacy", "privacy", "privacy.read"),
    ...admin("activity", "Activity", "activity", "activity.read"),
  ];
  const overview = can.has("overview.read");
  // Someone running a school reaches classes through the overview's table, so
  // the rail keeps only the ones they teach themselves.
  const shown = overview
    ? classes
        .filter((klass) => org.data.teaches?.includes(klass.id))
        .slice(0, VISIBLE_CLASSES_TAUGHT)
    : classes.slice(0, VISIBLE_CLASSES);
  const ancestors = org.data.ancestors ?? [];
  const parent = ancestors.at(-1);
  const sections: SchoolNavSection[] = [
    ...(parent
      ? [
          {
            items: [{ id: "up", label: parent.name, path: orgPath(parent.id) }],
          },
        ]
      : []),
    ...(overview
      ? [
          {
            items: [
              ...admin("overview", "Overview", "", "overview.read"),
              ...(isSchool
                ? []
                : admin("schools", "Schools", "schools", "overview.read")),
            ],
          },
        ]
      : []),
    {
      label: "Classes",
      items: [
        ...(isSchool
          ? shown.map((klass) => ({
              id: `class:${klass.id}`,
              label: klass.name,
              path: classPath(orgId, klass.id),
            }))
          : []),
        {
          id: "classes",
          label:
            classes.length <= shown.length
              ? "All classes"
              : classes.length === 1
                ? "1 class"
                : `All ${classes.length} classes`,
          path: orgPath(orgId, "classes"),
        },
      ],
    },
    {
      label: isSchool ? "School" : "Across schools",
      items: [...schoolItems, ...recordItems],
    },
  ];
  // Just my class: the rail lists that one class's screens; nothing else.
  const loneTabs: TabItem[] = [
    ...(classes[0]
      ? [
          {
            id: `class:${classes[0].id}`,
            label: classes[0].name,
            path: classPath(orgId, classes[0].id),
          },
        ]
      : [{ id: "classes", label: "Class", path: orgPath(orgId, "classes") }]),
    ...schoolItems.filter((item) => item.id !== "staff"),
    ...recordItems.filter((item) => item.id === "privacy"),
  ];
  return (
    <SchoolFrame
      title={title}
      lone={lone}
      orgSwitcher={
        // Just my class: the school's name is the class's, so only a way to
        // somewhere else earns the space.
        lone && !elsewhere ? undefined : (
          <OrgSwitcher
            current={orgId}
            name={org.data.name}
            ancestors={ancestors}
          />
        )
      }
      sections={sections}
      activeNav={nav}
      breadcrumb={[
        ...ancestors.map((entry) => ({
          label: entry.name,
          path: orgPath(entry.id),
        })),
        {
          label: org.data.name,
          path: overview ? orgPath(orgId) : orgPath(orgId, "classes"),
        },
        ...(crumbs.length ? crumbs : [{ label: title }]),
      ]}
      {...(lone
        ? tabs
          ? {
              tabs: [
                ...tabs,
                // The class's own Student experience tab is the school's here.
                ...schoolItems.filter(
                  (item) => item.id !== "staff" && item.id !== "experience",
                ),
                ...recordItems.filter((item) => item.id === "privacy"),
              ],
              activeTab,
            }
          : { tabs: loneTabs, activeTab: nav }
        : { tabs, activeTab })}
      account={<AccountMenu />}
    >
      {children}
    </SchoolFrame>
  );
}
