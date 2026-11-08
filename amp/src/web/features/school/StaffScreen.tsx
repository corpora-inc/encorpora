import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useState } from "react";
import type { StaffResource } from "../../../schools/setup-contracts";
import { AppError } from "../../lib/AppError";
import { useLoggedError } from "../../feedback";
import { Avatar } from "../../ui/Avatar";
import { Badge } from "../../ui/Badge";
import { Button, buttonClass } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { EmptyState } from "../../ui/EmptyState";
import { Segmented } from "../../ui/Segmented";
import { Sheet } from "../../ui/Sheet";
import { TextField } from "../../ui/TextField";
import {
  classesOptions,
  currentSession,
  orgOptions,
  refreshSchool,
  school,
  signInHelpOptions,
  staffOptions,
} from "./api";
import { OrgFrame } from "./OrgFrame";
import { CopyButton, FormNote, PageHead, roleNames } from "./parts";
import { orgPath } from "./paths";
import styles from "./School.module.css";
import { compareClassNames } from "./sort";

/** A long school address breaks after its @, never inside a word. */
function Address({ email }: { email: string }) {
  const at = email.indexOf("@");
  return at < 0 ? (
    <>{email}</>
  ) : (
    <>
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </>
  );
}

const message = (failure: unknown, fallback: string) =>
  failure instanceof AppError ? failure.message : fallback;
const INVITE_ROLES = ["teacher", "aide", "admin", "viewer"] as const;
type InviteRole = (typeof INVITE_ROLES)[number];
const roleHelp: Record<InviteRole, string> = {
  teacher: "Sees and manages the classes you give them.",
  aide: "Sees the classes you give them. Can’t change them.",
  admin: "Runs the whole school, including this screen.",
  viewer: "Reads everything. Changes nothing.",
};

function InviteForm({ orgId }: { orgId: string }) {
  const session = currentSession();
  const classes = [
    ...(useQuery(classesOptions(session, orgId)).data ?? []),
  ].sort((a, b) => compareClassNames(a.name, b.name));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InviteRole>("teacher");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  useLoggedError(error);
  const teaches = role === "teacher" || role === "aide";
  const submit = async () => {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setEmailError("Enter their full email address.");
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const sent = await school.invite(session, orgId, {
        email: address,
        role,
        ...(teaches && classIds.length ? { classIds } : {}),
      });
      await refreshSchool(session);
      setStatus(
        sent.linked
          ? `${address} already has an account here, so the role applies now.`
          : sent.mailed
            ? `Invitation sent to ${address}.`
            : `Invitation ready. The email didn’t send, so copy the link below and send it yourself.`,
      );
      setEmail("");
      setClassIds([]);
    } catch (failure) {
      setError(message(failure, "That invitation didn’t save. Try again."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className={styles.invite}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <h2>Invite someone</h2>
      <TextField
        label="Email"
        type="email"
        autoComplete="off"
        inputMode="email"
        placeholder="teacher@school.example"
        value={email}
        error={emailError}
        onChange={(event) => {
          setEmail(event.target.value);
          setEmailError("");
        }}
      />
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Role</span>
        <Segmented
          label="Role"
          compact
          dense
          value={role}
          onChange={setRole}
          options={INVITE_ROLES.map((value) => ({
            value,
            label: roleNames[value]!,
          }))}
        />
        <span className={styles.fieldHelp}>{roleHelp[role]}</span>
      </div>
      {teaches && classes.length > 0 && (
        <fieldset className={styles.classChecks}>
          <legend className={styles.fieldLabel}>Classes</legend>
          <div className={styles.classCheckList}>
            {classes.slice(0, 40).map((klass) => (
              <Checkbox
                key={klass.id}
                checked={classIds.includes(klass.id)}
                onChange={(checked) =>
                  setClassIds((prior) =>
                    checked
                      ? [...prior, klass.id]
                      : prior.filter((id) => id !== klass.id),
                  )
                }
              >
                {klass.name}
              </Checkbox>
            ))}
          </div>
        </fieldset>
      )}
      <Button
        variant="primary"
        type="submit"
        aria-busy={busy}
        disabled={busy}
        className={styles.inviteSend}
      >
        Send invitation
      </Button>
      <FormNote error={error} status={status} />
    </form>
  );
}

function StaffRow({
  person,
  orgId,
  manages,
  canEnd,
  onEdit,
}: {
  person: StaffResource;
  orgId: string;
  manages: boolean;
  canEnd: boolean;
  onEdit: () => void;
}) {
  const session = currentSession();
  const classes = [
    ...(useQuery(classesOptions(session, orgId)).data ?? []),
  ].sort((a, b) => compareClassNames(a.name, b.name));
  const [busy, setBusy] = useState<"resend" | "end" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  useLoggedError(error);
  const resend = async () => {
    setBusy("resend");
    setError("");
    setNote("");
    try {
      const sent = await school.resendInvite(session, orgId, person.id);
      await refreshSchool(session);
      setNote(
        sent.mailed
          ? "Sent again."
          : "The email didn’t send. Copy the link and send it yourself.",
      );
    } catch (failure) {
      setError(message(failure, "That didn’t send. Try again."));
    } finally {
      setBusy(null);
    }
  };
  const end = async () => {
    setBusy("end");
    setError("");
    try {
      await school.endStaff(session, orgId, person.id);
      await refreshSchool(session);
    } catch (failure) {
      setError(message(failure, "That didn’t save. Try again."));
      setBusy(null);
    }
  };
  const classList = person.classIds
    .map((id) => classes.find((klass) => klass.id === id)?.name)
    .filter(Boolean)
    .join(", ");
  // An admin can take classes too, and teaches them from then on.
  const teaches =
    person.roles.includes("teacher") ||
    person.roles.includes("aide") ||
    person.roles.includes("admin");
  // Until they accept, an invited person's only name is their address.
  const onlyAddress =
    person.status === "invited" && person.email?.split("@")[0] === person.name;
  const shown = onlyAddress ? person.email! : person.name;
  return (
    <li className={styles.staffRow}>
      <div className={styles.staffWho}>
        <Avatar name={shown} />
        <div className={styles.staffText}>
          <strong>
            {onlyAddress ? <Address email={shown} /> : shown}
            {person.self ? " (you)" : ""}
          </strong>
          {!onlyAddress && (
            <span>
              {person.email ? (
                <Address email={person.email} />
              ) : (
                "No email on file"
              )}
            </span>
          )}
          {teaches && (
            <span className={styles.staffClasses}>
              {classList || "No classes yet"}
            </span>
          )}
        </div>
        <div className={styles.staffBadges}>
          {person.roles.map((role) => (
            <Badge key={role}>{roleNames[role]}</Badge>
          ))}
          {person.status === "invited" && <Badge tone="warning">Invited</Badge>}
        </div>
      </div>
      {manages && (
        <div className={styles.staffActions}>
          {person.status === "invited" && person.inviteUrl && (
            <CopyButton
              text={person.inviteUrl}
              label="Copy invite link"
              copied="Link copied"
            />
          )}
          {person.status === "invited" && person.email && (
            <Button
              variant="secondary"
              aria-busy={busy === "resend"}
              disabled={!!busy}
              onClick={() => void resend()}
            >
              {person.inviteUrl ? "Send again" : "Send a new invitation"}
            </Button>
          )}
          {teaches && classes.length > 0 && (
            <Button variant="quiet" onClick={onEdit} disabled={!!busy}>
              Classes
            </Button>
          )}
          {canEnd &&
            (confirming ? (
              <>
                <button
                  type="button"
                  className={styles.danger}
                  aria-busy={busy === "end"}
                  disabled={!!busy}
                  onClick={() => void end()}
                >
                  End {person.status === "invited" ? "invitation" : "access"}{" "}
                  now
                </button>
                <Button
                  variant="quiet"
                  disabled={!!busy}
                  onClick={() => setConfirming(false)}
                >
                  Keep
                </Button>
              </>
            ) : (
              <Button variant="quiet" onClick={() => setConfirming(true)}>
                End access
              </Button>
            ))}
        </div>
      )}
      {(note || error) && <FormNote error={error} status={note} />}
    </li>
  );
}

function ClassesSheet({
  orgId,
  person,
  onClose,
}: {
  orgId: string;
  person: StaffResource;
  onClose: () => void;
}) {
  const session = currentSession();
  const classes = [
    ...(useQuery(classesOptions(session, orgId)).data ?? []),
  ].sort((a, b) => compareClassNames(a.name, b.name));
  const [classIds, setClassIds] = useState(person.classIds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useLoggedError(error);
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${person.name}’s classes`}
    >
      <div className={styles.sheetForm}>
        <div className={styles.classCheckList}>
          {classes.map((klass) => (
            <Checkbox
              key={klass.id}
              checked={classIds.includes(klass.id)}
              onChange={(checked) =>
                setClassIds((prior) =>
                  checked
                    ? [...prior, klass.id]
                    : prior.filter((id) => id !== klass.id),
                )
              }
            >
              {klass.name}
            </Checkbox>
          ))}
        </div>
        <FormNote error={error} />
        <Button
          variant="primary"
          className={styles.sheetAction}
          aria-busy={busy}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError("");
            void school
              .setStaffClasses(session, orgId, person.id, classIds)
              .then(() => refreshSchool(session))
              .then(onClose)
              .catch((failure) => {
                setError(message(failure, "That didn’t save. Try again."));
                setBusy(false);
              });
          }}
        >
          Save classes
        </Button>
      </div>
    </Sheet>
  );
}

/** Staff: who has access, who's still invited, and the way to end either. */
export function StaffScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const search = useSearch({ strict: false }) as { edit?: unknown };
  const navigate = useNavigate();
  const session = currentSession();
  const org = useQuery(orgOptions(session, orgId)).data;
  const staff = useQuery(staffOptions(session, orgId));
  const manages = org?.can?.includes("staff.manage") === true;
  const rows = staff.data ?? [];
  const admins = rows.filter(
    (person) => person.roles.includes("admin") && person.status === "active",
  );
  const editing = rows.find((person) => person.id === search.edit);
  const setEditing = (id: string | undefined) =>
    void navigate({
      to: ".",
      search: ((previous: Record<string, unknown>) => ({
        ...previous,
        edit: id,
      })) as never,
      resetScroll: false,
    });
  return (
    <OrgFrame orgId={orgId} nav="staff" title="Staff">
      <PageHead
        title="Staff"
        detail={`${rows.length} ${rows.length === 1 ? "person" : "people"}`}
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
      <div className={styles.staffLayout}>
        {manages && <InviteForm orgId={orgId} />}
        <section>
          {staff.isError ? (
            <EmptyState
              title="The staff list didn’t load"
              action={
                <Button
                  variant="secondary"
                  onClick={() => void staff.refetch()}
                >
                  Try again
                </Button>
              }
            />
          ) : (
            <ul className={styles.staffList}>
              {rows.map((person) => (
                <StaffRow
                  key={person.id}
                  person={person}
                  orgId={orgId}
                  manages={manages}
                  canEnd={
                    !(
                      person.roles.includes("admin") &&
                      person.status === "active" &&
                      admins.length <= 1
                    )
                  }
                  onEdit={() => setEditing(person.id)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
      {editing && (
        <ClassesSheet
          key={editing.id}
          orgId={orgId}
          person={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
    </OrgFrame>
  );
}

/** One page to send to IT: what to allow, with the values to paste. Nothing here
 * is secret, and a school with no IT department can skip it: cards and class
 * codes need none of this. */
export function SignInHelpScreen() {
  const { org: orgId } = useParams({ strict: false }) as { org: string };
  const session = currentSession();
  const help = useQuery(signInHelpOptions(session, orgId));
  const data = help.data;
  return (
    <OrgFrame orgId={orgId} nav="staff" title="Sign-in help">
      <PageHead
        title="Sign-in help for IT"
        detail="Only needed if your school signs in with Google Workspace or Microsoft 365."
        action={
          <CopyButton
            text={typeof location === "undefined" ? "" : location.href}
            label="Copy link to this page"
          />
        }
      />
      <div className={styles.helpBody}>
        <p className={styles.helpLead}>
          Student cards, class codes and email sign-in work with no IT setup. If
          your domain restricts third-party apps, allow AMP below so staff and
          students can use their school account.
        </p>
        {help.isError && (
          <EmptyState
            title="These details didn’t load"
            action={
              <Button variant="secondary" onClick={() => void help.refetch()}>
                Try again
              </Button>
            }
          />
        )}
        <section className={styles.helpSection}>
          <h2>Google Workspace</h2>
          {data?.google ? (
            <>
              <ol className={styles.helpSteps}>
                <li>
                  In the Google Admin console, open Security, then Access and
                  data control, then API controls.
                </li>
                <li>
                  Choose Manage third-party app access, then Add app, then OAuth
                  app name or client ID.
                </li>
                <li>Paste the client ID below and set AMP to Trusted.</li>
                <li>
                  For students under 18, keep it Trusted: Google blocks them
                  from any app that isn’t.
                </li>
                <li>
                  Tell your AMP admin it’s done. They turn Google on under
                  Integrations, and the button appears on each class’s join
                  page.
                </li>
              </ol>
              <div className={styles.helpValue}>
                <span className={styles.fieldLabel}>Client ID</span>
                <code>{data.google}</code>
                <CopyButton text={data.google} label="Copy client ID" />
              </div>
            </>
          ) : (
            <p className={styles.quiet}>
              Google sign-in isn’t turned on for this deployment. Email sign-in
              works for everyone in the meantime.
            </p>
          )}
        </section>
        <section className={styles.helpSection}>
          <h2>Microsoft 365</h2>
          {data?.microsoft ? (
            <>
              <ol className={styles.helpSteps}>
                <li>Sign in as a Microsoft Entra administrator.</li>
                <li>Open the admin-consent link below and approve AMP.</li>
                <li>
                  In Microsoft Entra, under Enterprise applications, check that
                  AMP’s “Assignment required” setting allows your students, or
                  assign their group to it.
                </li>
                <li>
                  AMP asks only for each person’s name and email. It doesn’t
                  read mail, files or anything else.
                </li>
                <li>
                  Tell your AMP admin it’s done. They turn Microsoft on under
                  Integrations, and the button appears on each class’s join
                  page.
                </li>
              </ol>
              <div className={styles.helpValue}>
                <span className={styles.fieldLabel}>Client ID</span>
                <code>{data.microsoft.clientId}</code>
                <CopyButton
                  text={data.microsoft.clientId}
                  label="Copy client ID"
                />
              </div>
              <a
                className={buttonClass("primary")}
                href={data.microsoft.adminConsentUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open admin consent
              </a>
              <p className={styles.quiet}>
                If Microsoft doesn’t confirm a person’s email address, AMP asks
                staff to use email sign-in and students to use their card or
                class code.
              </p>
            </>
          ) : (
            <p className={styles.quiet}>
              Microsoft sign-in isn’t turned on for this deployment. Email
              sign-in works for everyone in the meantime.
            </p>
          )}
        </section>
        <section className={styles.helpSection}>
          <h2>Mail filters</h2>
          <p>
            Invitations come from AMP’s address. If a filter holds them, the
            admin can always copy the invite link from the Staff screen and send
            it another way. Please also allow{" "}
            <code>{data?.origin || location.origin}</code> through any web
            filter.
          </p>
        </section>
      </div>
    </OrgFrame>
  );
}
