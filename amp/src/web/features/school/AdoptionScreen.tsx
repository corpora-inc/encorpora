import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import type { AdoptionReview } from "../../../schools/adoption-contracts";
import type { AuthSession } from "../../auth";
import { Button, buttonClass } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { EmptyState } from "../../ui/EmptyState";
import { LoadingScreen } from "../../ui/LoadingScreen";
import { Select } from "../../ui/Select";
import { TextField } from "../../ui/TextField";
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
import { CopyButton, FormNote, PageHead } from "./parts";
import "./SchoolFrame.module.css";
import styles from "./AdoptionScreen.module.css";
const day = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
const destination = (district: string, manage = false) =>
  `/school/adopt?district=${encodeURIComponent(district)}${manage ? "&manage=1" : ""}`;
const address = (path: string) => `${window.location.origin}${path}`;
function Failed({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <EmptyState
      title="This school connection could not be opened"
      action={
        <Button variant="secondary" onClick={retry}>
          Try again
        </Button>
      }
    >
      {adoptionError(error)}
    </EmptyState>
  );
}
function ShareLink({ url, label }: { url: string; label: string }) {
  return (
    <div className={styles.stack}>
      <TextField
        label={label}
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
      />
      <div className={styles.actions}>
        <CopyButton text={url} label="Copy link" />
      </div>
    </div>
  );
}
function DistrictInvite({
  session,
  districtId,
}: {
  session: AuthSession;
  districtId: string;
}) {
  const query = useQuery(adoptionDistrictQuery(session, districtId));
  if (query.isPending) return <LoadingScreen />;
  if (!query.data)
    return <Failed error={query.error} retry={() => void query.refetch()} />;
  return (
    <section className={styles.card}>
      <h2>{query.data.district.name}</h2>
      <p>
        Share this link with the teacher or administrator who manages the
        existing school in AMP. They choose their school and approve the move.
        You review and accept their approval here.
      </p>
      <ShareLink
        url={address(destination(districtId))}
        label="School invitation link"
      />
      <p>
        Classes, learners, work and pilot dates stay with their existing
        records.
      </p>
    </section>
  );
}
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
  if (query.isPending) return <LoadingScreen />;
  if (!query.data)
    return <Failed error={query.error} retry={() => void query.refetch()} />;
  const data = query.data,
    school = data.schools.find(
      (x) => x.id === (schoolId || data.schools[0]?.id),
    );
  return (
    <div className={styles.stack}>
      {data.district ? (
        <section className={styles.card}>
          <h2>Join {data.district.name}</h2>
          {issued ? (
            <>
              <p>
                Share this approval with an AMP administrator at{" "}
                {data.district.name}. They must review and accept it by{" "}
                {day(issued.expiresAt)}.
              </p>
              <ShareLink
                url={address(`/school/adopt#token=${issued.token}`)}
                label="District approval link"
              />
              <p>
                Only administrators of this district can use the link. You can
                withdraw it below before they accept.
              </p>
            </>
          ) : school ? (
            <>
              <p>
                Your school’s existing classes, students and work will become
                part of {data.district.name}. Its administrators will be able to
                manage them. Your classes and pilot dates stay the same.
              </p>
              <label className={styles.field}>
                School
                <Select
                  aria-label="School to join the district"
                  value={school.id}
                  onValueChange={(value) => {
                    setSchoolId(value);
                    setConfirmed(false);
                  }}
                >
                  {data.schools.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.classes}{" "}
                      {item.classes === 1 ? "class" : "classes"}
                    </option>
                  ))}
                </Select>
              </label>
              <Checkbox
                checked={confirmed}
                onChange={setConfirmed}
                disabled={busy}
              >
                I authorize {school.name} to join {data.district.name} and share
                its records with the district’s administrators.
              </Checkbox>
              <div className={styles.actions}>
                <Button
                  disabled={!confirmed || busy}
                  aria-busy={busy}
                  onClick={() => {
                    setBusy(true);
                    setError("");
                    void issueAdoption(session, school.id, data.district!.id)
                      .then(async (result) => {
                        setIssued(result);
                        await query.refetch();
                      })
                      .catch((e) => setError(adoptionError(e)))
                      .finally(() => setBusy(false));
                  }}
                >
                  Create district approval
                </Button>
              </div>
            </>
          ) : (
            <p>
              No standalone school is available to move from this account. Sign
              in as its administrator or the teacher who started and teaches all
              its active classes.
            </p>
          )}
          <FormNote error={error} />
        </section>
      ) : (
        <section className={styles.card}>
          <h2>Connect an existing school</h2>
          <p>
            Ask your district’s AMP administrator for a school invitation link.
            Open it to choose your school and approve sharing its records with
            that district.
          </p>
          <p>
            A move keeps the same learners, classes, learning history and pilot
            dates.
          </p>
        </section>
      )}
      {data.districts.length > 0 && (
        <section className={styles.card}>
          <h2>Your districts</h2>
          <p>
            Invite a school that already uses AMP to join a district you
            administer.
          </p>
          <ul className={styles.list}>
            {data.districts.map((district) => (
              <li className={styles.row} key={district.id}>
                <strong>{district.name}</strong>
                <Link
                  to={destination(district.id, true) as never}
                  className={buttonClass("secondary")}
                >
                  Invite a school
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {data.grants.length > 0 && (
        <section className={styles.card}>
          <h2>School approvals</h2>
          <ul className={styles.list}>
            {data.grants.map((grant) => (
              <li className={styles.row} key={grant.id}>
                <div>
                  <strong>
                    {grant.schoolName} → {grant.districtName}
                  </strong>
                  <span className={styles.help}>
                    {grant.status === "open"
                      ? `Awaiting district review · expires ${day(grant.expiresAt)}`
                      : {
                          used: "Accepted",
                          expired: "Expired",
                          revoked: "Withdrawn",
                        }[grant.status]}
                  </span>
                </div>
                {grant.status === "open" && (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      setError("");
                      void revokeAdoption(session, grant.id)
                        .then(async () => {
                          if (issued?.id === grant.id) setIssued(null);
                          await query.refetch();
                        })
                        .catch((e) => setError(adoptionError(e)))
                        .finally(() => setBusy(false));
                    }}
                  >
                    Withdraw approval
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <FormNote error={error} />
        </section>
      )}
    </div>
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
  if (query.isPending) return <LoadingScreen />;
  if (!query.data)
    return (
      <div className={styles.stack}>
        <Failed error={query.error} retry={() => void query.refetch()} />
        <div className={styles.actions}>
          <Button
            variant="secondary"
            onClick={() => {
              clearSchoolAdoption();
              void navigate({ to: "/school" as never });
            }}
          >
            Open your schools
          </Button>
        </div>
      </div>
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
  const cleverValid =
    !connectionId ||
    (!!preview.data &&
      !!cleverSchoolId &&
      data.sourcePeople.every((p) => people[p.id]) &&
      data.sourceClasses.every((c) => classes[c.id]));
  if (accepted)
    return (
      <section className={styles.card}>
        <h2>
          {data.schoolName} is part of {data.districtName}
        </h2>
        <p>
          The same classes, learners and learning history are ready to use.
          Staff retain their classroom roles.
        </p>
        <div className={styles.actions}>
          <Link
            to={`/school/${data.schoolId}` as never}
            className={buttonClass("primary")}
          >
            Open school
          </Link>
          {connectionId && (
            <Link
              to={"/school/connect" as never}
              className={buttonClass("secondary")}
            >
              Review and import Clever roster
            </Link>
          )}
        </div>
      </section>
    );
  return (
    <section className={styles.card}>
      <h2>
        {data.schoolName} → {data.districtName}
      </h2>
      <p>
        The school has approved this move. Review its records before accepting.
        This approval expires {day(data.expiresAt)}.
      </p>
      <dl className={styles.stats}>
        <div>
          <dt>Learners</dt>
          <dd>{data.learners}</dd>
        </div>
        <div>
          <dt>Classes</dt>
          <dd>{data.classes}</dd>
        </div>
      </dl>
      <p>
        District administrators will be able to manage the school. Learner IDs,
        work, class memberships, licenses and pilot dates stay on the existing
        records.
      </p>
      {data.staffMatches.length > 0 && (
        <div className={styles.stack}>
          <h3>Staff with a place in both institutions</h3>
          <p>
            These records use the same signed-in AMP account. Confirm each pair
            to keep one district staff record and its school roles.
          </p>
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
              {match.sourceName} at the school and {match.targetName} in the
              district belong to the same staff member.
              {!match.allowed && " This record needs support review."}
            </Checkbox>
          ))}
        </div>
      )}
      {blocked && (
        <div className={styles.conflict}>
          <p>
            Some records need review before the school can move. Contact
            support@corpora.inc with the school and district names. Nothing has
            changed.
          </p>
          <CopyButton text="support@corpora.inc" label="Copy support address" />
        </div>
      )}
      {!blocked && data.cleverConnections.length > 0 && (
        <details className={styles.details}>
          <summary>Match the school’s Clever roster (optional)</summary>
          <div>
            <p>
              Before the first Clever import, match each existing person and
              class to its Clever record. If any are missing, update Clever’s
              sharing settings or keep the existing roster for this move.
            </p>
            <label className={styles.field}>
              Clever connection
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
                    {c.districtName} · {c.environment}
                  </option>
                ))}
              </Select>
            </label>
            {connectionId &&
              (preview.isPending ? (
                <LoadingScreen />
              ) : preview.error ? (
                <Failed
                  error={preview.error}
                  retry={() => void preview.refetch()}
                />
              ) : (
                preview.data && (
                  <>
                    <label className={styles.field}>
                      School in Clever
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
                    </label>
                    {cleverSchoolId && (
                      <>
                        <h3>People</h3>
                        {data.sourcePeople.map((p) => (
                          <label className={styles.field} key={p.id}>
                            {p.name} · {p.student ? "student" : "staff"}
                            <Select
                              aria-label={`Clever match for ${p.name}`}
                              value={people[p.id] ?? ""}
                              onValueChange={(value) =>
                                setPeople((old) => ({ ...old, [p.id]: value }))
                              }
                            >
                              <option value="">
                                Choose the same person in Clever
                              </option>
                              {preview
                                .data!.users.filter(
                                  (u) => u.student === p.student,
                                )
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} · {u.id.slice(-6)}
                                  </option>
                                ))}
                            </Select>
                          </label>
                        ))}
                        <h3>Classes</h3>
                        {data.sourceClasses.map((c) => (
                          <label className={styles.field} key={c.id}>
                            {c.name}
                            <Select
                              aria-label={`Clever match for ${c.name}`}
                              value={classes[c.id] ?? ""}
                              onValueChange={(value) =>
                                setClasses((old) => ({ ...old, [c.id]: value }))
                              }
                            >
                              <option value="">
                                Choose the same class in Clever
                              </option>
                              {preview.data!.sections.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name} · {s.id.slice(-6)}
                                </option>
                              ))}
                            </Select>
                          </label>
                        ))}
                      </>
                    )}
                  </>
                )
              ))}
          </div>
        </details>
      )}
      {!blocked && (
        <>
          <Checkbox checked={confirmed} onChange={setConfirmed} disabled={busy}>
            I have reviewed this school’s records and authorize it to join{" "}
            {data.districtName}.
          </Checkbox>
          <div className={styles.actions}>
            <Button
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
          </div>
        </>
      )}
      <FormNote error={error} />
    </section>
  );
}
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
  return (
    <main className={styles.screen} data-dense>
      <PageHead
        title="School connections"
        detail="Bring an existing school into its district."
      />
      <div className={styles.stack}>
        {token && !districtId ? (
          <ReviewSchool session={session} token={token} />
        ) : districtId && query.get("manage") === "1" ? (
          <DistrictInvite session={session} districtId={districtId} />
        ) : (
          <AuthorizeSchool session={session} districtId={districtId} />
        )}
      </div>
    </main>
  );
}
