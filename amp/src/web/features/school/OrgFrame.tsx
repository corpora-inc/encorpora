import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppError } from "../../lib/AppError";
import { Button, buttonClass } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { Loading } from "../../ui/Loading";
import { currentSession, orgOptions } from "./api";
import type { SchoolCrumb } from "./SchoolFrame";
import frame from "./SchoolFrame.module.css";

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

/** Content under AppShell; related screens stay reachable from their group. */
export function OrgFrame({
  orgId,
  nav,
  title,
  children,
}: {
  orgId: string;
  nav: NavId;
  title: string;
  crumbs?: readonly SchoolCrumb[];
  children: ReactNode;
}) {
  const org = useQuery({
    ...orgOptions(currentSession(), orgId),
    refetchOnMount: false,
  });
  const pathname = useLocation({ select: (location) => location.pathname });
  if (org.isPending)
    return (
      <main className={frame.content} data-dense>
        <Loading />
      </main>
    );
  if (!org.data) {
    // Not found says so; anything else is this request, and trying again works.
    const missing =
      !(org.error instanceof AppError) || org.error.status === 404;
    return (
      <main id="school-content" className={frame.content} data-dense>
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
      </main>
    );
  }
  const can = new Set(org.data.can ?? []);
  const related =
    nav === "classes" ||
    nav === "students" ||
    nav === "import" ||
    nav === "experience"
      ? [
          ...(org.data.kind !== "family"
            ? [["students", "Students", "students.read"]]
            : []),
          ...(org.data.kind === "school"
            ? [["import", "Import students", "roster.import"]]
            : []),
          ["experience", "Student experience", "settings.read"],
        ]
      : nav === "staff" || nav === "integrations" || nav === "sign-in-help"
        ? [
            ["sign-in-help", "Sign-in help", "staff.read"],
            ["integrations", "Integrations", "integrations.read"],
          ]
        : nav === "overview" || nav === "schools"
          ? org.data.kind !== "school"
            ? [["schools", "Schools", "overview.read"]]
            : []
          : [];
  const links = related.filter(
    ([path, , permission]) =>
      pathname !== `/school/${orgId}/${path}` && can.has(permission as never),
  );
  return (
    <main
      id="school-content"
      tabIndex={-1}
      className={frame.content}
      data-dense
    >
      {nav.startsWith("class:") && <p className={frame.place}>{title}</p>}
      {links.length > 0 && (
        <nav className={frame.links} aria-label="Related school screens">
          {links.map(([path, label]) => (
            <Link
              key={path}
              to="/$"
              params={{ _splat: `school/${orgId}/${path}` }}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
      {children}
    </main>
  );
}
