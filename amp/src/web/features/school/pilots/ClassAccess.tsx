import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { AGREEMENT_VERSION } from "../../../../schools/agreement";
import type { PilotState } from "../../../../schools/pilot-contracts";
import { AppError } from "../../../lib/AppError";
import { queryClient } from "../../../lib/query";
import { useLoggedError } from "../../../feedback";
import { Button } from "../../../ui/Button";
import { Sheet } from "../../../ui/Sheet";
import { Stepper } from "../../../ui/Stepper";
import { TextArea, TextField } from "../../../ui/TextField";
import { Toast } from "../../../ui/Toast";
import { currentSession, orgOptions, refreshSchool } from "../api";
import { useClassSearch } from "../classes/teacher-shared";
import type { FeedEntry } from "../classes/today/Feed";
import { Authorization } from "./Authorization";
import { pilotApi, pilotOptions, purchaseRequestOptions } from "./api";
import { accessView, practiceDate, type AccessView } from "./presentation";
import styles from "./Pilot.module.css";

type Place = { org: string; class: string };

/** Where a school class stands on practice access, read once and shared by
 * Today, Students and Settings (the same query, so each says the same). */
export function useClassAccess(place: Place): {
  view: AccessView;
  pilot: PilotState | undefined;
} {
  const session = currentSession();
  const org = useQuery({
    ...orgOptions(session, place.org),
    refetchOnMount: false,
  }).data;
  const school = org?.kind === "school" && !org.demo;
  const pilot = useQuery({
    ...pilotOptions(session, place.class),
    enabled: school,
  }).data;
  if (!school || !pilot) return { view: { kind: "none" }, pilot };
  return {
    view: accessView(pilot, org?.teaches?.includes(place.class) ?? false),
    pilot,
  };
}

/** Practice is over for this class: its sign-in tools lead nowhere. */
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
  label = "Start",
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
): FeedEntry | null {
  const entry = (
    title: string,
    detail: string,
    actions: FeedEntry["actions"],
  ) =>
    ({
      id: `practice-${view.kind}`,
      title,
      detail,
      mark: "plain",
      actions,
    }) as const;
  switch (view.kind) {
    case "start":
      return entry(
        "Start practice",
        view.joining
          ? `Through ${practiceDate(view.until)}`
          : `30 days, through ${practiceDate(view.until)}`,
        <StartPracticeButton place={place} pilot={pilot} />,
      );
    case "waiting":
      return entry(
        "Waiting for the class’s teacher to start practice",
        "",
        <RequestSeatsButton primary={false} />,
      );
    case "ending":
      return entry(
        `Practice ends ${practiceDate(view.until)}`,
        "",
        <RequestSeatsButton primary />,
      );
    case "ended":
      return entry("Practice has ended", "", <RequestSeatsButton primary />);
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
  if (view.kind === "start")
    return (
      <StartPracticeButton place={place} pilot={pilot} label="Start practice" />
    );
  if (view.kind === "ended") return <RequestSeatsButton primary />;
  return null;
}

/** Class Settings: practice access in one quiet line. */
export function AccessLine({ place }: { place: Place }) {
  const { view } = useClassAccess(place);
  const [, setSearch] = useClassSearch();
  const text =
    view.kind === "active"
      ? `Pilot through ${practiceDate(view.until)}`
      : view.kind === "ending"
        ? `Practice ends ${practiceDate(view.until)}`
        : view.kind === "ended"
          ? "Practice has ended"
          : null;
  if (!text) return null;
  return (
    <div className={styles.accessLine} data-access={view.kind}>
      <span className={styles.accessLabel}>Practice</span>
      <p>{text}</p>
      <Button
        variant="quiet"
        align="start"
        onClick={() => setSearch({ seats: 1 })}
      >
        Request seats
      </Button>
    </div>
  );
}

/** The sheets practice access opens over a class page, by address
 * (`?seats=1`, `?authorize=1`), so Back and refresh keep them. */
export function AccessSheets({ place }: { place: Place }) {
  const { view, pilot } = useClassAccess(place);
  const [search, , close] = useClassSearch();
  const seats = search.seats === 1 || search.seats === "1";
  const authorize = search.authorize === 1 || search.authorize === "1";
  if (view.kind === "none") return null;
  return (
    <>
      <RequestSeatsSheet
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
  const existing = useQuery(purchaseRequestOptions(session, place.class));
  const request = existing.data?.request ?? null;
  const made = request?.url ?? null;
  const [count, setCount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  const seats = count ?? Math.max(1, students);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await pilotApi.purchase(session, {
        orgId: place.org,
        classIds: [place.class],
        seats,
        note: note.trim(),
      });
      await queryClient.invalidateQueries({
        queryKey: purchaseRequestOptions(session, place.class).queryKey,
      });
    } catch (failure) {
      setError(
        failure instanceof AppError
          ? failure.message
          : "The link didn’t save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const copy = (url: string) =>
    void navigator.clipboard.writeText(url).then(
      () => setCopied(true),
      (failure) => {
        console.error("The buyer link couldn’t be copied", failure);
        setCopyFailed(true);
      },
    );
  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title="Send to your school’s buyer"
      >
        {existing.isPending ? (
          <div className={styles.sheetBody} aria-busy="true" />
        ) : made ? (
          <div className={styles.sheetBody}>
            <p className={styles.quiet}>
              {request!.seats.toLocaleString()}{" "}
              {request!.seats === 1 ? "seat" : "seats"} · Expires{" "}
              {practiceDate(request!.expiresAt)}
            </p>
            <div className={styles.sheetActions}>
              <Button
                variant="primary"
                onClick={() => copy(made)}
                data-share-url={made}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
              <a
                href={made}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                className={styles.quietLink}
              >
                Preview
              </a>
            </div>
            {copyFailed && (
              <TextField
                label="Select the link and copy it"
                value={made}
                readOnly
                onFocus={(event) => event.target.select()}
              />
            )}
          </div>
        ) : (
          <form className={styles.sheetBody} onSubmit={submit}>
            <Stepper
              label="Seats"
              value={seats}
              min={1}
              max={9999}
              onChange={setCount}
            />
            <TextArea
              label="Note for the buyer (optional)"
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
                Get link
              </Button>
            </div>
          </form>
        )}
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
              Start
            </Button>
          </div>
        </form>
      </Sheet>
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}
