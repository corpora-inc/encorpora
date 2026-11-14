import { useQuery } from "@tanstack/react-query";
import { CopyButton } from "../parts";
import { useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import type { PilotState } from "../../../../schools/pilot-contracts";
import { AppError } from "../../../lib/AppError";
import { queryClient } from "../../../lib/query";
import { useLoggedError } from "../../../feedback";
import { Link } from "@tanstack/react-router";
import { Button, buttonClass } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Sheet } from "../../../ui/Sheet";
import { Stepper } from "../../../ui/Stepper";
import { TextArea } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { currentSession, orgOptions, refreshSchool } from "../api";
import { classYearOptions } from "../org/org-api";
import { useClassSearch } from "../classes/teacher-shared";
import type { FeedEntry } from "../classes/today/Feed";
import { Authorization } from "./Authorization";
import { pilotApi, pilotOptions, purchaseRequestOptions } from "./api";
import { accessView, practiceDate, type AccessView } from "./presentation";
import styles from "./Pilot.module.css";
import school from "../School.module.css";

type Place = { org: string; class: string };

/** Whether a class's students can practice, as the server says (its
 * class-year read): the sign-in tools (the code, the board, cards) follow
 * this exactly, for every role. `unknown`: it couldn't be read. */
export type Practice = "open" | "waiting" | "ended" | "unknown";

/** Where a school class stands on practice access, read once and shared by
 * Today, Students and Settings (the same queries, so each says the same).
 * The server's practice state decides whether its sign-in tools are open;
 * the pilot, for those who may read it, says what to do about it (start,
 * when it ends, partial coverage). */
export function useClassAccess(place: Place): {
  view: AccessView;
  pilot: PilotState | undefined;
  teaches: boolean;
  /** Still learning where the class stands: screens hold their sign-in
   * tools' place rather than show and then withdraw them. */
  pending: boolean;
  practice: Practice;
  /** No student can sign in now (or it couldn't be checked): its code,
   * board and cards are withheld. */
  closed: boolean;
  /** Where the class stands couldn't be checked: say so, with Try again. */
  unavailable: boolean;
  retry: () => void;
} {
  const session = currentSession();
  const org = useQuery({
    ...orgOptions(session, place.org),
    refetchOnMount: false,
  }).data;
  const school = org?.kind === "school" && !org.demo;
  const teaches = org?.teaches?.includes(place.class) ?? false;
  // Only someone the server lets read the class's pilot asks for it: its
  // teacher, or an administrator. A viewer or an aide would only be
  // refused, and a refused read would hold the screen's wait forever.
  const readable = teaches || (org?.can?.includes("pilot.read") ?? false);
  // A failed read stays failed until Try again (or a change invalidates
  // it): each screen that mounts must not ask again, or a wait that holds
  // the screen would ask forever.
  const query = useQuery({
    ...pilotOptions(session, place.class),
    enabled: school && readable,
    retryOnMount: false,
  });
  // Whether students can practice, for every reader of the class (a viewer
  // and an aide too): the sign-in tools follow the class, never the role.
  const year = useQuery({
    ...classYearOptions(session, place.class),
    enabled: school,
    refetchOnMount: false,
    retryOnMount: false,
  });
  const retry = () => {
    void year.refetch();
    if (readable) void query.refetch();
  };
  const pilot = query.data;
  const pending =
    !org || (school && (year.isPending || (readable && query.isPending)));
  if (!school)
    return {
      view: { kind: "none" },
      pilot,
      teaches,
      pending,
      practice: "open",
      closed: false,
      unavailable: false,
      retry,
    };
  // Unknown is never open: a failed read, or an answer without the state.
  const practice: Practice = year.data
    ? (year.data.practice ?? "unknown")
    : year.isError
      ? "unknown"
      : "waiting";
  const unavailable =
    !pending && (practice === "unknown" || (readable && query.isError));
  const view: AccessView = pilot
    ? accessView(pilot, teaches)
    : practice === "ended"
      ? { kind: "ended" }
      : practice === "waiting"
        ? { kind: "waiting" }
        : { kind: "none" };
  return {
    view,
    pilot,
    teaches,
    pending,
    practice,
    closed: practice !== "open",
    unavailable,
    retry,
  };
}

/** Practice is over for this class. */
export const practiceEnded = (view: AccessView) => view.kind === "ended";

/** Starting practice: at once when the class is authorized, else through
 * the authorization sheet (a class that arrived from a roster sync). */
function useStartPractice(place: Place, pilot: PilotState | undefined) {
  const session = currentSession();
  const [, setSearch] = useClassSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const start = async () => {
    if (!pilot || busy) return;
    if (!pilot.authorized) {
      setSearch({ authorize: 1 });
      return;
    }
    setBusy(true);
    setError("");
    try {
      await pilotApi.activate(session, place.class);
      await refreshSchool(session);
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "Practice didn’t start. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return { start, busy, error, clear: () => setError("") };
}

export function StartPracticeButton({
  place,
  pilot,
  label = "Start practice",
}: {
  place: Place;
  pilot: PilotState | undefined;
  label?: string;
}) {
  const { start, busy, error, clear } = useStartPractice(place, pilot);
  return (
    <>
      <Button
        variant="primary"
        aria-busy={busy}
        disabled={busy}
        onClick={() => void start()}
      >
        {label}
      </Button>
      <Toast message={error} onDismiss={clear} />
    </>
  );
}

export function RequestSeatsButton({ primary }: { primary: boolean }) {
  const [, setSearch] = useClassSearch();
  return (
    <Button
      variant={primary ? "primary" : "secondary"}
      onClick={() => setSearch({ seats: 1 })}
    >
      Request seats
    </Button>
  );
}

/** Today's feed item for practice access: only while there is something to
 * do about it (start, or arrange seats). Active practice needs no item. */
export function accessFeedEntry(
  view: AccessView,
  place: Place,
  pilot: PilotState | undefined,
  canRequest: boolean,
): FeedEntry | null {
  // Starting is required, the rest are states: none has a box to tick.
  const entry = (
    title: string,
    detail: string,
    actions: FeedEntry["actions"],
  ) =>
    ({
      id: `practice-${view.kind}`,
      title,
      detail,
      // Practice access is never an optional to-do: no box to tick, the
      // one required action at the end of its line.
      mark: "status",
      actions,
    }) as const;
  switch (view.kind) {
    case "start":
      return entry(
        "Start practice",
        view.joining
          ? `Through ${practiceDate(view.until)}`
          : `30 days, through ${practiceDate(view.until)}`,
        // The title names the action; its button says only Start.
        <StartPracticeButton place={place} pilot={pilot} label="Start" />,
      );
    case "waiting":
      return entry(
        "Waiting for the class’s teacher to start practice",
        "",
        null,
      );
    case "ending":
      return entry(
        `Practice ends ${practiceDate(view.until)}`,
        "",
        canRequest ? <RequestSeatsButton primary /> : null,
      );
    case "ended":
      return entry(
        "Practice has ended",
        "",
        canRequest ? <RequestSeatsButton primary /> : null,
      );
    case "partial":
      return entry(
        `${view.covered} of ${view.students} students have practice access`,
        canRequest
          ? "Request seats for the rest of the class."
          : "The class’s teacher can request the remaining seats.",
        canRequest ? <RequestSeatsButton primary={false} /> : null,
      );
    default:
      return null;
  }
}

/** The Students header's one primary action while practice isn't running:
 * Start practice before, Request seats after. The bar's Start class takes
 * the same place once practice runs, so the header never reflows. */
export function AccessHeaderAction({
  view,
  place,
  pilot,
}: {
  view: AccessView;
  place: Place;
  pilot: PilotState | undefined;
}) {
  const { teaches } = useClassAccess(place);
  if (view.kind === "start")
    return <StartPracticeButton place={place} pilot={pilot} />;
  if (view.kind === "ended" && teaches) return <RequestSeatsButton primary />;
  return null;
}

/** Class Settings: practice, as a section like every other (its heading,
 * one quiet line, and Request seats for its teacher). */
export function AccessLine({ place }: { place: Place }) {
  const { view, teaches } = useClassAccess(place);
  const [, setSearch] = useClassSearch();
  const text =
    view.kind === "active"
      ? `Through ${practiceDate(view.until)}`
      : view.kind === "ending"
        ? `Ends ${practiceDate(view.until)}`
        : view.kind === "ended"
          ? "Ended"
          : view.kind === "partial"
            ? `${view.covered} of ${view.students} students have access`
            : null;
  if (!text) return null;
  return (
    <section
      className={school.settingsSection}
      aria-labelledby="class-practice"
      data-access={view.kind}
    >
      <div className={school.settingsHead}>
        <div>
          <h2 id="class-practice">Practice</h2>
          <p className={school.quiet}>{text}</p>
        </div>
        {teaches && (
          <Button variant="secondary" onClick={() => setSearch({ seats: 1 })}>
            Request seats
          </Button>
        )}
      </div>
    </section>
  );
}

/** The sheets practice access opens over a class page, by address
 * (`?seats=1`, `?authorize=1`), so Back and refresh keep them. */
export function AccessSheets({ place }: { place: Place }) {
  const { view, pilot, teaches } = useClassAccess(place);
  const [search, , close] = useClassSearch();
  const seats = search.seats === 1 || search.seats === "1";
  const authorize = search.authorize === 1 || search.authorize === "1";
  if (view.kind === "none" || !teaches) return null;
  return (
    <>
      <RequestSeatsSheet
        key={`${currentSession().accountId}:${place.class}`}
        place={place}
        students={pilot?.coverage?.students ?? 0}
        open={seats}
        onClose={() => close("seats")}
      />
      {view.kind === "start" && pilot && !pilot.authorized && (
        <AuthorizeSheet
          place={place}
          until={view.until}
          open={authorize}
          onClose={() => close("authorize")}
        />
      )}
    </>
  );
}

/** Who holds the overlapping request, from the server's scoped refusal. */
function holderName(body: unknown): string {
  const parsed = z
    .object({
      conflicts: z.array(z.object({ holderName: z.string() })),
    })
    .safeParse(body);
  if (!parsed.success) return "";
  return [
    ...new Set(
      parsed.data.conflicts.map((row) => row.holderName.trim()).filter(Boolean),
    ),
  ].join(" and ");
}

function RequestSeatsSheet({
  place,
  students,
  open,
  onClose,
}: {
  place: Place;
  students: number;
  open: boolean;
  onClose: () => void;
}) {
  const session = currentSession();
  // The class's open buyer link, read from the server: it survives a
  // refresh, and asking again returns the same one.
  const existing = useQuery({
    ...purchaseRequestOptions(session, place.class),
    enabled: open,
  });
  const request = existing.data?.request ?? null;
  const made = request?.url ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  // Another teacher's open link already covers this class: say who, and
  // offer no button that would only be refused again.
  const [holder, setHolder] = useState<string | null>(null);
  useLoggedError(error);
  useLoggedError(existing.error?.message ?? "");
  useLoggedError(
    holder === null ? "" : "Another teacher’s buyer link covers this class.",
  );
  const seats = count ?? Math.max(1, students);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await pilotApi.purchase(session, {
        orgId: place.org,
        classIds:
          editing && request?.canEdit ? request.classIds : [place.class],
        seats,
        note: note.trim(),
      });
      await queryClient.invalidateQueries({
        queryKey: purchaseRequestOptions(session, place.class).queryKey,
      });
      setEditing(false);
      setHolder(null);
    } catch (failure) {
      if (
        failure instanceof AppError &&
        failure.code === "purchase_scope_conflict"
      ) {
        setHolder(holderName(failure.body));
        setEditing(false);
        await existing.refetch();
      } else
        setError(
          failure instanceof AppError
            ? failure.message
            : "The link didn’t save. Try again.",
        );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Send to your school’s buyer"
      >
        {/* Every state holds the form's height, so the sheet never jumps
            between the form, the link and a wait. */}
        <div className={styles.seatsBody}>
          {existing.isPending ? (
            <Loading>Opening the request</Loading>
          ) : existing.error ? (
            <div className={styles.sheetBody}>
              <p role="alert">The buyer request couldn’t load. Try again.</p>
              <Button
                variant="secondary"
                aria-busy={existing.isFetching}
                onClick={() => void existing.refetch()}
              >
                Try again
              </Button>
            </div>
          ) : made && !editing ? (
            <div className={styles.sheetBody}>
              {holder !== null && (
                <p className={styles.quiet} role="status">
                  {holder
                    ? `${holder} already has a buyer link for this class. You can share it below.`
                    : "A buyer link already covers this class. You can share it below."}
                </p>
              )}
              <p className={styles.quiet}>
                {request!.seats.toLocaleString()}{" "}
                {request!.seats === 1 ? "seat" : "seats"} · Expires{" "}
                {practiceDate(request!.expiresAt)}
              </p>
              {!!request?.note && (
                <p className={styles.quiet}>{request.note}</p>
              )}
              <div className={styles.sheetActions}>
                <CopyButton
                  text={made}
                  label="Copy link"
                  primary
                  shareUrl={made}
                />
                <a
                  href={made}
                  target="_blank"
                  rel="noreferrer"
                  referrerPolicy="no-referrer"
                  className={styles.quietLink}
                >
                  Preview
                </a>
                {request?.canEdit && (
                  <Button
                    variant="quiet"
                    onClick={() => {
                      setCount(request.seats);
                      setNote(request.note);
                      setEditing(true);
                      setHolder(null);
                    }}
                  >
                    Edit request
                  </Button>
                )}
              </div>
            </div>
          ) : holder !== null ? (
            <div className={styles.sheetBody}>
              <p className={styles.quiet} role="status">
                {holder
                  ? `${holder} already has a buyer link for this class. Ask ${holder} for it.`
                  : "Another teacher already has a buyer link for this class. Ask them for it."}
              </p>
            </div>
          ) : (
            <form className={styles.sheetBody} onSubmit={submit}>
              {editing && (
                <p className={styles.quiet}>
                  Saving creates a new link to share with your school.
                </p>
              )}
              <Stepper
                label="Seats"
                value={seats}
                min={1}
                max={9999}
                onChange={setCount}
              />
              <TextArea
                label="Note for the buyer (optional)"
                hint="The buyer sees this. Leave out students’ names."
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                rows={3}
              />
              <div className={styles.sheetActions}>
                <Button
                  type="submit"
                  variant="primary"
                  aria-busy={busy}
                  disabled={busy}
                >
                  {editing ? "Save request" : "Get link"}
                </Button>
                {editing && (
                  <Button
                    variant="quiet"
                    disabled={busy}
                    onClick={() => setEditing(false)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          )}
        </div>
      </Sheet>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

function AuthorizeSheet({
  place,
  until,
  open,
  onClose,
}: {
  place: Place;
  until: string;
  open: boolean;
  onClose: () => void;
}) {
  const session = currentSession();
  const [name, setName] = useState(session.name ?? "");
  const [title, setTitle] = useState("Teacher");
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await pilotApi.authorize(session, place.class, {
        version: AGREEMENT_VERSION,
        signerName: name.trim(),
        signerTitle: title.trim(),
        authorized: true,
      });
      await pilotApi.activate(session, place.class);
      await refreshSchool(session);
      onClose();
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "Practice didn’t start. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Start practice"
        description={`30 days, through ${practiceDate(until)}`}
      >
        <form className={styles.sheetBody} onSubmit={submit}>
          <Authorization
            name={name}
            title={title}
            authorized={authorized}
            onName={setName}
            onTitle={setTitle}
            onAuthorized={setAuthorized}
            disabled={busy}
          />
          <div className={styles.sheetActions}>
            <Button
              type="submit"
              variant="primary"
              aria-busy={busy}
              disabled={busy || !authorized || !name.trim() || !title.trim()}
            >
              Start practice
            </Button>
          </div>
        </form>
      </Sheet>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}

/** In place of a sign-in tool (the board, cards) while no student of the
 * class can practice: the code reaches students only once practice runs, so
 * this says where the class stands and offers the one next step that works.
 * Null while practice runs, or for a class without a pilot (a family's). */
export function ClosedSignIn({
  place,
  also,
  onRetry,
}: {
  place: Place;
  /** A way back beside the next step (the board's Exit). */
  also?: ReactNode;
  /** Also read again what the screen itself read (the board's presence). */
  onRetry?: () => void;
}) {
  const { view, pilot, teaches, practice, unavailable, retry } =
    useClassAccess(place);
  const actions = (next: ReactNode) => (
    <div className={styles.sheetActions}>
      {next}
      {also}
    </div>
  );
  const today = `/school/${place.org}/classes/${place.class}/today`;
  const to = (label: string, search: Record<string, number> = {}) => (
    <Link
      to={today as never}
      search={search as never}
      className={buttonClass("primary")}
    >
      {label}
    </Link>
  );
  // Couldn't check, or the answers disagree (the code withheld while the
  // class reads as open): say so calmly, and try again.
  if (unavailable || practice === "open" || practice === "unknown")
    return (
      <EmptyState
        title="Couldn’t check practice"
        action={actions(
          <Button
            variant="primary"
            onClick={() => {
              retry();
              onRetry?.();
            }}
          >
            Try again
          </Button>,
        )}
      >
        The class’s code shows here once it’s clear its students can practice.
      </EmptyState>
    );
  if (practice === "waiting" && view.kind === "empty")
    return (
      <EmptyState
        title="Add your students first"
        action={actions(
          <Link
            to={`/school/${place.org}/classes/${place.class}/import` as never}
            className={buttonClass("primary")}
          >
            Add students
          </Link>,
        )}
      />
    );
  if (practice === "waiting" && view.kind === "start")
    return (
      <EmptyState
        title="Practice hasn’t started"
        action={actions(
          // Starting may first need the authorization sheet, which Today
          // holds; an authorized class starts right here.
          pilot?.authorized ? (
            <StartPracticeButton place={place} pilot={pilot} />
          ) : (
            to("Start practice", { authorize: 1 })
          ),
        )}
      >
        {view.joining
          ? `Through ${practiceDate(view.until)}`
          : `30 days, through ${practiceDate(view.until)}`}
      </EmptyState>
    );
  if (practice === "waiting")
    return (
      <EmptyState
        title="Waiting for the class’s teacher to start practice"
        action={actions(also ? null : to("Back to Today"))}
      />
    );
  return (
    <EmptyState
      title="Practice has ended"
      action={actions(
        teaches
          ? to("Request seats", { seats: 1 })
          : also
            ? null
            : to("Back to Today"),
      )}
    >
      Reports, exports and workbooks stay with the class.
    </EmptyState>
  );
}
