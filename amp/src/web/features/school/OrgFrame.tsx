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
import {
  SchoolFrame,
  type SchoolCrumb,
  type SchoolNavSection,
} from "./SchoolFrame";
import styles from "./School.module.css";

const VISIBLE_CLASSES = 8;
export type NavId =
  | "classes"
  | "students"
  | "staff"
  | "calendar"
  | "import"
  | "license"
  | "sign-in-help"
  | "experience"
  | `class:${string}`;

function AccountMenu() {
  const session = currentSession();
  const me = useQuery(meOptions(session)).data;
  const navigate = useNavigate();
  const email = me?.signedIn ? (me.account.email ?? "") : "";
  const hasFamily = me?.signedIn && me.learners.length > 0;
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
      {hasFamily && (
        <MenuItem onSelect={() => void navigate({ to: "/" })}>
          Family and learners
        </MenuItem>
      )}
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

function OrgSwitcher({ current, name }: { current: string; name: string }) {
  const orgs = useQuery(orgsOptions(currentSession())).data ?? [];
  const navigate = useNavigate();
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
  children,
}: {
  orgId: string;
  nav: NavId;
  title: string;
  crumbs?: readonly SchoolCrumb[];
  children: ReactNode;
}) {
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId));
  const classes = useQuery(classesOptions(session, orgId)).data ?? [];
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
  const admin = (id: NavId, label: string, path: string, action: string) =>
    can.has(action as never) ? [{ id, label, path: orgPath(orgId, path) }] : [];
  const schoolItems = [
    { id: "students", label: "Students", path: orgPath(orgId, "students") },
    ...admin("staff", "Staff", "staff", "staff.read"),
    { id: "calendar", label: "Calendar", path: orgPath(orgId, "calendar") },
    {
      id: "experience",
      label: "Student experience",
      path: orgPath(orgId, "experience"),
    },
    ...admin("import", "Import", "import", "roster.import"),
    ...admin("license", "License", "license", "license.read"),
  ];
  const shown = classes.slice(0, VISIBLE_CLASSES);
  const sections: SchoolNavSection[] = [
    {
      label: "Classes",
      items: [
        ...shown.map((klass) => ({
          id: `class:${klass.id}`,
          label: klass.name,
          path: classPath(orgId, klass.id),
        })),
        {
          id: "classes",
          label:
            classes.length > VISIBLE_CLASSES
              ? `All ${classes.length} classes`
              : "All classes",
          path: orgPath(orgId, "classes"),
        },
      ],
    },
    { label: "School", items: schoolItems },
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
  ];
  return (
    <SchoolFrame
      title={title}
      lone={lone}
      orgSwitcher={<OrgSwitcher current={orgId} name={org.data.name} />}
      sections={sections}
      activeNav={nav}
      breadcrumb={[
        { label: org.data.name, path: orgPath(orgId, "classes") },
        ...(crumbs.length ? crumbs : [{ label: title }]),
      ]}
      {...(lone ? { tabs: loneTabs, activeTab: nav } : {})}
      account={<AccountMenu />}
    >
      {children}
    </SchoolFrame>
  );
}
