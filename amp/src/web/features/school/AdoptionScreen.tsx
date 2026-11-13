import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import type { AdoptionReview } from "../../../schools/adoption-contracts";
import type { AuthSession } from "../../auth";
import { useLoggedError } from "../../feedback";
import { Button, buttonClass } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { Select } from "../../ui/Select";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { currentSession, refreshSchool } from "./api";
import {
  acceptAdoption,
  adoptionCleverQuery,
  adoptionDistrictQuery,
  adoptionError,
  adoptionOptionsQuery,
  adoptionReviewQuery,
  issueAdoption,
  revokeAdoption,
} from "./adoption-api";
import {
  clearSchoolAdoption,
  prepareSchoolAdoption,
  schoolAdoptionToken,
} from "./adoption-session";
import { Actions, Lead, PlainPage } from "./PlainPage";
import { adoptionLabels } from "./adoption-labels";
import { AdoptionMatching } from "./AdoptionMatching";
import styles from "./AdoptionScreen.module.css";

const day = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(value),
  );
const address = (path: string) => `${window.location.origin}${path}`;
const plural = (count: number, one: string, many = `${one}s`) =>
  `${count.toLocaleString()} ${count === 1 ? one : many}`;

function Failed({
  error,
  retry,
  label = "Try again",
}: {
  error: unknown;
  retry: () => void;
  label?: string;
}) {
  const message = adoptionError(error);
  useLoggedError(message);
  return (
    <PlainPage title="This link didn’t open" back="/school">
      <Lead>{message}</Lead>
      <Actions>
        <Button variant="secondary" onClick={retry}>
          {label}
        </Button>
      </Actions>
    </PlainPage>
  );
}

/** The link copied out of AMP: one button, the address kept on it for
 * assistive tools and tests rather than shown as a field. */
function CopyLink({ url }: { url: string }) {
  const [state, setState] = useState<"copied" | "failed" | null>(null);
  return (
    <>
      <Actions>
        <Button
          variant="primary"
          data-primary
          data-share-url={url}
          onClick={() =>
            void navigator.clipboard.writeText(url).then(
              () => setState("copied"),
              (failure) => {
                console.error("The link could not be copied", failure);
                setState("failed");
              },
            )
          }
        >
          {state === "copied" ? "Copied" : "Copy link"}
        </Button>
      </Actions>
      {state === "failed" && (
        <TextField
          label="Select the link and copy it"
          readOnly
          value={url}
          onFocus={(event) => event.target.select()}
        />
      )}
    </>
  );
}

/** A district admin's invitation: the link a school opens to approve. */
function DistrictInvite({
  session,
  districtId,
}: {
  session: AuthSession;
  districtId: string;
}) {
  const query = useQuery(adoptionDistrictQuery(session, districtId));
  if (query.isPending) return <LoadingScreen overlay />;
  if (!query.data)
    return <Failed error={query.error} retry={() => void query.refetch()} />;
  return (
    <PlainPage
      title={`Invite a school to ${query.data.district.name}`}
      back="/school"
    >
      <Lead>
        Send this link to the school. You’ll accept here once they approve.
      </Lead>
      <CopyLink
        url={address(
          `/school/adopt?district=${encodeURIComponent(districtId)}`,
        )}
      />
    </PlainPage>
  );
}

function SchoolHomeRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate({ href: "/school", replace: true });
  }, [navigate]);
  return <LoadingScreen overlay />;
}

/** The school's side: approve joining a district, then send the approval. */
function AuthorizeSchool({
  session,
  districtId,
}: {
  session: AuthSession;
  districtId?: string;
}) {
  const query = useQuery(adoptionOptionsQuery(session, districtId));
  const [schoolId, setSchoolId] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [issued, setIssued] = useState<{
    id: string;
    token: string;
    expiresAt: string;
  } | null>(null);
  useLoggedError(error);
  if (query.isPending) return <LoadingScreen overlay />;
  if (!query.data)
    return <Failed error={query.error} retry={() => void query.refetch()} />;
  const data = query.data;
  const district = data.district;
  const school = data.schools.find(
    (x) => x.id === (schoolId || data.schools[0]?.id),
  );
  const open = data.grants.filter((grant) => grant.status === "open");
  // Nothing to approve, invite or withdraw: this page has no job here.
  if (!district && !data.districts.length && !open.length)
    return <SchoolHomeRedirect />;
  const withdraw = (id: string) => {
    setBusy(true);
    setError("");
    void revokeAdoption(session, id)
      .then(async () => {
        if (issued?.id === id) setIssued(null);
        await query.refetch();
      })
      .catch((e) => setError(adoptionError(e)))
      .finally(() => setBusy(false));
  };
  return (
    <PlainPage
      title={district ? `Join ${district.name}` : "Districts"}
      back="/school"
    >
      {district &&
        (issued ? (
          <>
            <Lead>
              Send this to {district.name}. It expires {day(issued.expiresAt)}.
            </Lead>
            <CopyLink url={address(`/school/adopt#token=${issued.token}`)} />
          </>
        ) : school ? (
          <>
            <Lead>
              {district.name}’s admins will manage {school.name}. Classes and
              work stay the same.
            </Lead>
            {data.schools.length > 1 && (
              <Select
                aria-label="School"
                value={school.id}
                onValueChange={(value) => {
                  setSchoolId(value);
                  setConfirmed(false);
                }}
              >
                {data.schools.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {plural(item.classes, "class", "classes")}
                  </option>
                ))}
              </Select>
            )}
            <Checkbox
              checked={confirmed}
              onChange={setConfirmed}
              disabled={busy}
            >
              I authorize {school.name} to join {district.name} and share its
              records with the district’s administrators.
            </Checkbox>
            <Actions>
              <Button
                variant="primary"
                data-primary
                disabled={!confirmed || busy}
                aria-busy={busy}
                onClick={() => {
                  setBusy(true);
                  setError("");
                  void issueAdoption(session, school.id, district.id)
                    .then(async (result) => {
                      setIssued(result);
                      await query.refetch();
                    })
                    .catch((e) => setError(adoptionError(e)))
                    .finally(() => setBusy(false));
                }}
              >
                Approve
              </Button>
            </Actions>
          </>
        ) : (
          <Lead>Only the school’s admin can approve this.</Lead>
        ))}
      {!district && data.districts.length > 0 && (
        <ul className={styles.rows}>
          {data.districts.map((item) => (
            <li key={item.id}>
              <span>{item.name}</span>
              <Link
                to="/school/adopt"
                search={{ district: item.id, manage: 1 }}
                className={buttonClass("secondary")}
              >
                Invite a school
              </Link>
            </li>
          ))}
        </ul>
      )}
      {open.length > 0 && !issued && (
        <ul className={styles.rows} aria-label="Approvals">
          {open.map((grant) => (
            <li key={grant.id}>
              <span>
                {grant.schoolName} → {grant.districtName}
                <small>Expires {day(grant.expiresAt)}</small>
              </span>
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => withdraw(grant.id)}
              >
                Withdraw
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </PlainPage>
  );
}

function ReviewSchool({
  session,
  token,
}: {
  session: AuthSession;
  token: string;
}) {
  const navigate = useNavigate();
  const query = useQuery(adoptionReviewQuery(session, token));
  if (query.isPending) return <LoadingScreen overlay />;
  if (!query.data)
    return (
      <Failed
        error={query.error}
        label="Open your schools"
        retry={() => {
          clearSchoolAdoption();
          void navigate({ to: "/$", params: { _splat: "school" } });
        }}
      />
    );
  return (
    <ReviewDecision
      key={`${session.accountId}:${token.slice(-8)}`}
      session={session}
      token={token}
      data={query.data}
    />
  );
}

/** The district's side: what moves, who is the same person, and accept. */
function ReviewDecision({
  session,
  token,
  data,
}: {
  session: AuthSession;
  token: string;
  data: AdoptionReview;
}) {
  const [matches, setMatches] = useState<string[]>([]),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false);
  const [connectionId, setConnectionId] = useState(""),
    [cleverSchoolId, setCleverSchoolId] = useState(""),
    [people, setPeople] = useState<Record<string, string>>({}),
    [classes, setClasses] = useState<Record<string, string>>({});
  useLoggedError(error);
  const preview = useQuery(
    adoptionCleverQuery(
      session,
      token,
      connectionId,
      cleverSchoolId || undefined,
    ),
  );
  const blocked =
    data.conflicts.some((c) => c.code !== "account_already_in_district") ||
    data.staffMatches.some((match) => !match.allowed);
  const allMatches = data.staffMatches.every((match) =>
    matches.includes(match.sourcePersonId),
  );
  const users = useMemo(
    () => adoptionLabels(preview.data?.users ?? []),
    [preview.data?.users],
  );
  const sections = useMemo(
    () => adoptionLabels(preview.data?.sections ?? []),
    [preview.data?.sections],
  );
  const sourcePeople = useMemo(
    () => adoptionLabels(data.sourcePeople),
    [data.sourcePeople],
  );
  const sourceClasses = useMemo(
    () => adoptionLabels(data.sourceClasses),
    [data.sourceClasses],
  );
  const usersById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const sectionsById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );
  const cleverValid =
    !connectionId ||
    (!!preview.data &&
      !!cleverSchoolId &&
      sourcePeople.every((person) => {
        const match = usersById.get(people[person.id]);
        return (
          !person.ambiguous &&
          !!match &&
          !match.ambiguous &&
          match.student === person.student
        );
      }) &&
      sourceClasses.every((section) => {
        const match = sectionsById.get(classes[section.id]);
        return !section.ambiguous && !!match && !match.ambiguous;
      }) &&
      new Set(sourcePeople.map((person) => people[person.id])).size ===
        sourcePeople.length &&
      new Set(sourceClasses.map((section) => classes[section.id])).size ===
        sourceClasses.length);
  if (accepted)
    return (
      <PlainPage
        title={`${data.schoolName} joined ${data.districtName}`}
        back="/school"
      >
        <Actions>
          <a
            href={`/school/${data.schoolId}`}
            className={buttonClass("primary")}
            data-primary
          >
            Open school
          </a>
          {connectionId && (
            <Link to="/school/connect" className={buttonClass("secondary")}>
              Import Clever roster
            </Link>
          )}
        </Actions>
      </PlainPage>
    );
  return (
    <PlainPage
      title={`${data.schoolName} wants to join ${data.districtName}`}
      back="/school"
      wide
    >
      <Lead>Expires {day(data.expiresAt)}</Lead>
      <dl className={styles.stats}>
        <div>
          <dt>Students</dt>
          <dd>{data.learners.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Classes</dt>
          <dd>{data.classes.toLocaleString()}</dd>
        </div>
      </dl>
      {data.staffMatches.length > 0 && (
        <section className={styles.section}>
          <h2>Same person?</h2>
          {data.staffMatches.map((match) => (
            <Checkbox
              key={match.sourcePersonId}
              checked={matches.includes(match.sourcePersonId)}
              disabled={!match.allowed || busy}
              onChange={(checked) =>
                setMatches((old) =>
                  checked
                    ? [...old, match.sourcePersonId]
                    : old.filter((id) => id !== match.sourcePersonId),
                )
              }
            >
              {match.sourceName} and {match.targetName}
            </Checkbox>
          ))}
        </section>
      )}
      {blocked ? (
        <Lead>Contact support@corpora.inc to finish this move.</Lead>
      ) : (
        <>
          {data.cleverConnections.length > 0 && (
            <details className={styles.details}>
              <summary>Match to Clever (optional)</summary>
              <div className={styles.section}>
                <Select
                  aria-label="Clever connection"
                  value={connectionId}
                  onValueChange={(value) => {
                    setConnectionId(value);
                    setCleverSchoolId("");
                    setPeople({});
                    setClasses({});
                  }}
                >
                  <option value="">Keep the existing roster</option>
                  {data.cleverConnections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.districtName}
                    </option>
                  ))}
                </Select>
                {connectionId &&
                  (preview.isPending ? (
                    <div className={styles.wait} aria-busy="true" />
                  ) : preview.error ? (
                    <p role="alert">{adoptionError(preview.error)}</p>
                  ) : (
                    preview.data && (
                      <>
                        <Select
                          aria-label="School in Clever"
                          value={cleverSchoolId}
                          onValueChange={(value) => {
                            setCleverSchoolId(value);
                            setPeople({});
                            setClasses({});
                          }}
                        >
                          <option value="">Choose a school</option>
                          {preview.data.schools.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                        {cleverSchoolId && (
                          <AdoptionMatching
                            people={{
                              source: sourcePeople,
                              candidates: users,
                              values: people,
                            }}
                            classes={{
                              source: sourceClasses,
                              candidates: sections,
                              values: classes,
                            }}
                            disabled={busy}
                            onChange={(kind, id, value) => {
                              const update =
                                kind === "people" ? setPeople : setClasses;
                              update((old) => {
                                const next = { ...old };
                                if (value) next[id] = value;
                                else delete next[id];
                                return next;
                              });
                            }}
                          />
                        )}
                      </>
                    )
                  ))}
              </div>
            </details>
          )}
          <Checkbox checked={confirmed} onChange={setConfirmed} disabled={busy}>
            I have reviewed this school’s records and authorize it to join{" "}
            {data.districtName}.
          </Checkbox>
          <Actions>
            <Button
              variant="primary"
              data-primary
              disabled={busy || !confirmed || !allMatches || !cleverValid}
              aria-busy={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                void acceptAdoption(session, token, {
                  staffMerges: data.staffMatches.map(
                    ({ sourcePersonId, targetPersonId }) => ({
                      sourcePersonId,
                      targetPersonId,
                    }),
                  ),
                  ...(connectionId
                    ? {
                        cleverSchool: {
                          connectionId,
                          schoolId: cleverSchoolId,
                        },
                        cleverPeople: Object.entries(people).map(
                          ([personId, userId]) => ({ personId, userId }),
                        ),
                        cleverSections: Object.entries(classes).map(
                          ([classId, sectionId]) => ({ classId, sectionId }),
                        ),
                      }
                    : {}),
                })
                  .then(async () => {
                    clearSchoolAdoption();
                    setAccepted(true);
                    await refreshSchool(session);
                  })
                  .catch((e) => setError(adoptionError(e)))
                  .finally(() => setBusy(false));
              }}
            >
              Add school to district
            </Button>
          </Actions>
        </>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </PlainPage>
  );
}

/** `/school/adopt`: an existing school joins a district. The school approves
 * by a district's invitation link; the district reviews by the approval link. */
export function AdoptionScreen() {
  const session = currentSession(),
    location = useLocation();
  const query = new URLSearchParams(location.searchStr),
    parsed = z.uuid().safeParse(query.get("district"));
  const districtId = parsed.success ? parsed.data : undefined;
  prepareSchoolAdoption();
  const [token, setToken] = useState(schoolAdoptionToken);
  useEffect(
    () => setToken(schoolAdoptionToken()),
    [location.hash, session.accountId],
  );
  return token && !districtId ? (
    <ReviewSchool session={session} token={token} />
  ) : districtId && query.get("manage") === "1" ? (
    <DistrictInvite session={session} districtId={districtId} />
  ) : (
    <AuthorizeSchool session={session} districtId={districtId} />
  );
}
