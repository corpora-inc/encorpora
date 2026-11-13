import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { formatDay } from "../../../../schools/calendar";
import type { IntegrationsResponse } from "../../../../schools/org-contracts";
import { AppError } from "../../../lib/AppError";
import { useLoggedError } from "../../../feedback";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Segmented } from "../../../ui/Segmented";
import { Toast } from "../../../ui/Toast";
import { ProviderMark } from "../../auth/ProviderButtons";
import { currentSession, orgOptions, refreshSchool } from "../api";
import { number } from "../classes/teacher-shared";
import { OrgFrame } from "../OrgFrame";
import { PageHead } from "../parts";
import { orgPath } from "../paths";
import {
  integrationsOptions,
  requestIntegration,
  setSignInProvider,
} from "./org-api";
import styles from "./Org.module.css";

function Row({
  mark,
  title,
  detail,
  children,
}: {
  mark?: ReactNode;
  title: string;
  detail: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={styles.integration}>
      {mark && <span className={styles.integrationMark}>{mark}</span>}
      <div className={styles.integrationWords}>
        <h3>{title}</h3>
        <p>{detail}</p>
      </div>
      {children && <div className={styles.integrationAction}>{children}</div>}
    </li>
  );
}

function SetUpWithUs({
  id,
  name,
  requestedAt,
  canManage,
  orgId,
  onError,
  onDone,
}: {
  id: string;
  name: string;
  requestedAt: string | null;
  canManage: boolean;
  orgId: string;
  onError: (message: string) => void;
  onDone: (message: string) => void;
}) {
  const session = currentSession();
  const [busy, setBusy] = useState(false);
  if (requestedAt)
    return (
      <span className={styles.requested}>
        Requested {formatDay(requestedAt.slice(0, 10))}. We’ll write to you.
      </span>
    );
  if (!canManage) return null;
  return (
    <Button
      variant="secondary"
      aria-busy={busy}
      disabled={busy}
      aria-label={`Set up ${name} with us`}
      onClick={() => {
        setBusy(true);
        void requestIntegration(session, orgId, id)
          .then(() => refreshSchool(session))
          .then(() =>
            onDone(`Request sent. We’ll write to you about ${name} shortly.`),
          )
          .catch((failure) =>
            onError(
              failure instanceof AppError
                ? failure.message
                : "The request didn’t send. Email support@corpora.inc.",
            ),
          )
          .finally(() => setBusy(false));
      }}
    >
      Set this up with us
    </Button>
  );
}

function reachWords(provider: IntegrationsResponse["providers"][number]) {
  const parts = [
    `${number(provider.eligible)} ${provider.eligible === 1 ? "student has" : "students have"} a roster email that works with it`,
  ];
  if (provider.noEmail)
    parts.push(`${number(provider.noEmail)} without an email keep cards`);
  if (provider.sharedEmail)
    parts.push(`${number(provider.sharedEmail)} sharing an email keep cards`);
  return `${parts.join(". ")}.`;
}

/** What this school has connected, and what we'll set up with them. Everything
 * here either works now or sends a real request. */
export function IntegrationsScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const view = useQuery(integrationsOptions(session, orgId));
  const data = view.data;
  const canManage = org?.can?.includes("integrations.manage") === true;
  const canImport = org?.can?.includes("roster.import") === true;
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  const many = (data?.providers[0]?.schools ?? 1) > 1;
  const names = { google: "Google", microsoft: "Microsoft" } as const;
  return (
    <OrgFrame orgId={orgId} nav="integrations" title="Integrations">
      <PageHead
        title="Integrations"
        action={
          <Link
            to="/$"
            params={{ _splat: orgPath(orgId, "sign-in-help") }}
            className={buttonClass("secondary")}
          >
            Sign-in help for IT
          </Link>
        }
      />
      {view.isPending ? (
        <Loading />
      ) : !data ? (
        <EmptyState
          title="Integrations didn’t load"
          action={
            <Button variant="secondary" onClick={() => void view.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className={styles.integrations}>
          <section aria-labelledby="integrations-files">
            <h2 id="integrations-files" className={styles.sectionTitle}>
              Rosters and grades
            </h2>
            <ul className={styles.integrationList}>
              <Row
                title="Spreadsheet or OneRoster file"
                detail={`${number(data.rostered)} ${data.rostered === 1 ? "student" : "students"} on the roster. Bring in a file any time: it adds and updates, and never removes anyone.`}
              >
                {canImport && (
                  <Link
                    to="/$"
                    params={{ _splat: orgPath(orgId, "import") }}
                    className={buttonClass("secondary")}
                  >
                    Import a roster
                  </Link>
                )}
              </Row>
              <Row
                title="Gradebook export"
                detail="Any class’s grades as a spreadsheet, or as OneRoster results for your SIS, from that class’s gradebook."
              >
                {data.firstClass && (
                  <Link
                    to="/$"
                    params={{
                      _splat: orgPath(
                        orgId,
                        `classes/${data.firstClass}/gradebook`,
                      ),
                    }}
                    className={buttonClass("secondary")}
                  >
                    Open a gradebook
                  </Link>
                )}
              </Row>
            </ul>
          </section>
          <section aria-labelledby="integrations-sign-in">
            <h2 id="integrations-sign-in" className={styles.sectionTitle}>
              Student sign-in
            </h2>
            <p className={styles.sectionLead}>
              Cards and class codes always work. A school account adds a sign-in
              button to your class join pages.
            </p>
            <ul className={styles.integrationList}>
              {data.providers.map((provider) => (
                <Row
                  key={provider.id}
                  mark={<ProviderMark provider={provider.id} />}
                  title={names[provider.id]}
                  detail={
                    !provider.available
                      ? "We can turn this on for you."
                      : many
                        ? `On at ${provider.schoolsOn} of ${provider.schools} schools. ${reachWords(provider)}`
                        : reachWords(provider)
                  }
                >
                  {!provider.available ? (
                    <SetUpWithUs
                      id={provider.id}
                      name={names[provider.id]}
                      requestedAt={provider.requestedAt}
                      canManage={canManage}
                      orgId={orgId}
                      onError={setError}
                      onDone={setNotice}
                    />
                  ) : canManage ? (
                    <div className={styles.providerSwitch}>
                      <Segmented
                        label={`${names[provider.id]} sign-in${many ? " at every school" : ""}`}
                        compact
                        dense
                        disabled={saving === provider.id}
                        value={provider.on ? "on" : "off"}
                        onChange={(value) => {
                          setSaving(provider.id);
                          void setSignInProvider(session, orgId, {
                            provider: provider.id,
                            enabled: value === "on",
                          })
                            .then(() => refreshSchool(session))
                            .then(() =>
                              setNotice(
                                `${names[provider.id]} sign-in is ${value === "on" ? "on" : "off"}.`,
                              ),
                            )
                            .catch((failure) =>
                              setError(
                                failure instanceof AppError
                                  ? failure.message
                                  : "That didn’t save. Try again.",
                              ),
                            )
                            .finally(() => setSaving(null));
                        }}
                        options={[
                          { value: "off", label: "Off" },
                          { value: "on", label: "On" },
                        ]}
                      />
                    </div>
                  ) : (
                    <span className={styles.requested}>
                      {provider.on ? "On" : "Off"}
                    </span>
                  )}
                </Row>
              ))}
            </ul>
          </section>
          <section aria-labelledby="integrations-sync">
            <h2 id="integrations-sync" className={styles.sectionTitle}>
              Automatic roster sync
            </h2>
            <ul className={styles.integrationList}>
              {data.requests.map((request) => {
                const about = {
                  clever: {
                    name: "Clever",
                    detail: "Rosters and sign-in from your Clever district.",
                  },
                  classlink: {
                    name: "ClassLink",
                    detail: "Rosters and sign-in through ClassLink.",
                  },
                  "google-classroom": {
                    name: "Google Classroom",
                    detail: "Classes and students from Google Classroom.",
                  },
                }[request.id];
                return (
                  <Row
                    key={request.id}
                    title={about.name}
                    detail={about.detail}
                  >
                    <SetUpWithUs
                      id={request.id}
                      name={about.name}
                      requestedAt={request.requestedAt}
                      canManage={canManage}
                      orgId={orgId}
                      onError={setError}
                      onDone={setNotice}
                    />
                  </Row>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      <Toast tone="status" message={notice} onDismiss={() => setNotice("")} />
      <Toast message={error} onDismiss={() => setError("")} />
    </OrgFrame>
  );
}
