import { useQuery } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  gradeCourse,
  gradeTitle,
  levelName,
  MAX_PROFILE_LEVEL,
  paceLevel,
  paceNames,
  presetLabel,
  presetLevels,
  PROFILE_LABEL_MAX,
  profilePaces,
  profileStrands,
  type ProfileLevels,
  type ProfilePace,
} from "../../../learning/practice-profiles";
import { strandNames } from "../../BirthYearPrompt";
import type { AuthSession } from "../../auth";
import { AppError } from "../../lib/AppError";
import { meOptions } from "../../lib/query";
import { Button, buttonClass } from "../../ui/Button";
import { Dialog } from "../../ui/Dialog";
import { EmptyState } from "../../ui/EmptyState";
import { Loading } from "../../ui/Loading";
import { Segmented, type SegmentedOption } from "../../ui/Segmented";
import { Stepper } from "../../ui/Stepper";
import { TextField } from "../../ui/TextField";
import { Toast } from "../../ui/Toast";
import { currentSession } from "../school/api";
import { useLearnerStore } from "../../learner-store";
import {
  choosePracticeProfile,
  leaveTarget,
  useCreateProfile,
  useDeleteProfile,
  useUpdateProfile,
} from "./api";
import { GradePicker } from "./GradePicker";
import styles from "./Profiles.module.css";

const paceOptions: SegmentedOption<ProfilePace>[] = profilePaces.map(
  (pace) => ({
    value: pace,
    label: paceNames[pace],
    detail:
      pace === "behind"
        ? "A grade below"
        : pace === "ahead"
          ? "A grade above"
          : "At grade",
  }),
);

/** What the levels say, in one line that is always there. */
function levelsSummary(levels: ProfileLevels) {
  const values = Object.values(levels);
  const low = Math.min(...values);
  const high = Math.max(...values);
  return low === high
    ? `Every area starts at ${level(low)}.`
    : `Areas start from ${level(low)} to ${level(high)}.`;
}
/** A level's name that never breaks across lines: "Grade 3". */
const level = (at: number) => levelName(at).replace(/ /g, "\u00a0");

function failureText(error: unknown, fallback: string) {
  if (error instanceof AppError) {
    if (error.code === "profile_not_found")
      return "This profile isn’t in your account anymore. Choose another from your places.";
    if (error.code === "too_many_learners")
      return "This account has 1,000 learners and profiles, the most one account can hold. Delete a profile to make another.";
    if (error.kind === "network") return error.message;
    if (error.kind === "validation")
      return "Check the name and levels, then try again.";
  }
  return fallback;
}

/** One strand's starting level: its name and a stepper from K to
 * Precalculus. */
function StrandLevels({
  levels,
  onChange,
  disabled,
  layout,
}: {
  levels: ProfileLevels;
  onChange: (levels: ProfileLevels) => void;
  disabled: boolean;
  /** `columns`: two columns, each name above its stepper (the wide screen's
   * panel). `rows`: one row per strand, name and stepper side by side (the
   * sheet), stacking only where a row can't hold both. */
  layout: "columns" | "rows";
}) {
  return (
    <ul
      className={`${styles.strands} ${layout === "columns" ? styles.columns : styles.rows}`}
      aria-disabled={disabled || undefined}
    >
      {profileStrands.map((strand) => (
        <li key={strand} className={styles.strand} data-strand={strand}>
          <span className={styles.strandName} aria-hidden="true">
            {strandNames[strand] ?? strand}
          </span>
          <Stepper
            label={strandNames[strand] ?? strand}
            hideLabel
            value={levels[strand]}
            min={0}
            max={MAX_PROFILE_LEVEL}
            format={levelName}
            onChange={(level) => {
              if (!disabled) onChange({ ...levels, [strand]: level });
            }}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The profile, as one form: a grade and a pace fill every strand (a new
 * profile only), any strand moves up or down, and the profile is saved under
 * a name. On a phone it reads top to bottom with the action pinned to the
 * foot; with room, the choices sit beside the levels.
 */
function ProfileForm({
  heading,
  intro,
  choose,
  label,
  onLabel,
  levels,
  onLevels,
  submit,
  pending,
  onSubmit,
  aside,
  levelsReady = true,
}: {
  heading: string;
  intro: string;
  /** The grade and pace, for a new profile. */
  choose?: ReactNode;
  label: string;
  onLabel: (label: string) => void;
  levels: ProfileLevels;
  onLevels: (levels: ProfileLevels) => void;
  submit: string;
  pending: boolean;
  onSubmit: () => void;
  /** Quieter actions beside the main one. */
  aside?: ReactNode;
  /** False until a new profile has a grade: levels before one say nothing. */
  levelsReady?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const empty = !label.trim();
  const summary = levelsSummary(levels);
  return (
    <>
      <form
        className={styles.form}
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (empty || pending) return;
          onSubmit();
        }}
      >
        <header className={styles.head}>
          <h1>{heading}</h1>
          <p>{intro}</p>
        </header>
        <section className={styles.choose} aria-label="Who to practice as">
          {choose}
          <TextField
            label="Name"
            placeholder="e.g. Grade 8 on level"
            value={label}
            maxLength={PROFILE_LABEL_MAX}
            autoComplete="off"
            spellCheck={false}
            disabled={pending}
            error={touched && empty ? "Give this profile a name." : undefined}
            onChange={(event) => {
              setTouched(true);
              onLabel(event.target.value);
            }}
          />
          {/* Below the wide layout the levels open in a sheet of their own. */}
          <div className={styles.levelsRow} hidden={!levelsReady}>
            <div className={styles.levelsRowText}>
              <span className={styles.fieldLabel}>Levels by area</span>
              <span className={styles.caption} data-levels-summary>
                {summary.replace(/^Areas start from /, "From ")}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              className={styles.adjust}
              disabled={pending}
              onClick={() => setAdjusting(true)}
            >
              Adjust
            </Button>
          </div>
        </section>
        <section
          className={styles.levels}
          aria-labelledby="profile-levels"
          hidden={!levelsReady}
        >
          <div className={styles.levelsHead}>
            <h2 id="profile-levels">Levels by area</h2>
            <p data-levels-summary>{summary}</p>
          </div>
          <StrandLevels
            layout="columns"
            levels={levels}
            onChange={onLevels}
            disabled={pending}
          />
        </section>
        <div className={styles.actions}>
          <Button
            variant="primary"
            className={styles.go}
            aria-busy={pending || undefined}
            // Saving needs a name: a grade fills one in. Until then the action
            // holds its place, quiet, and comes up as soon as it can work.
            data-waiting={(empty && !pending) || undefined}
            disabled={pending || empty}
          >
            {submit}
          </Button>
          {aside}
        </div>
      </form>
      <Dialog
        aboveNavigation
        fullOnPhone
        open={adjusting}
        title="Levels by area"
        onOpenChange={setAdjusting}
      >
        <p className={styles.sheetSummary} data-levels-summary>
          {summary}
        </p>
        <StrandLevels
          layout="rows"
          levels={levels}
          onChange={onLevels}
          disabled={pending}
        />
        <Button
          type="button"
          variant="primary"
          className={styles.done}
          onClick={() => setAdjusting(false)}
        >
          Done
        </Button>
      </Dialog>
    </>
  );
}

/** The search a picker URL keeps: the grade and pace chosen. */
export type NewProfileSearch = { grade?: number; pace?: ProfilePace };
export function newProfileSearch(
  search: Record<string, unknown>,
): NewProfileSearch {
  const grade = Number(search.grade);
  const pace = profilePaces.find((value) => value === search.pace);
  return {
    ...(Number.isInteger(grade) && grade >= 0 && grade <= MAX_PROFILE_LEVEL
      ? { grade }
      : {}),
    ...(pace ? { pace } : {}),
  };
}

/** `/me/profiles/new` ("Try a level…"): practice as someone else, at a grade
 * and pace, adjusted area by area, saved under a name. The grade and pace
 * live in the URL, so a refresh or a shared link opens the same choice. */
export function NewProfileScreen() {
  const session = currentSession();
  const navigate = useNavigate();
  const search = newProfileSearch(
    useSearch({ strict: false }) as Record<string, unknown>,
  );
  const grade = search.grade ?? null;
  const pace = search.pace ?? "on-level";
  const preset = (at: number | null, by: ProfilePace) =>
    at === null ? presetLevels(4, "on-level") : presetLevels(at, by);
  const [levels, setLevels] = useState<ProfileLevels>(() =>
    preset(grade, pace),
  );
  const [label, setLabel] = useState(() =>
    grade === null ? "" : presetLabel(grade, pace),
  );
  const [named, setNamed] = useState(false);
  const create = useCreateProfile(session);
  const choose = (next: { grade: number; pace: ProfilePace }) => {
    create.reset();
    setLevels(presetLevels(next.grade, next.pace));
    if (!named) setLabel(presetLabel(next.grade, next.pace));
    void navigate({
      to: "/$",
      params: { _splat: "me/profiles/new" },
      search: { grade: next.grade, pace: next.pace } as never,
      replace: true,
    });
  };
  const course = grade === null ? null : gradeCourse(grade);
  return (
    <main className={styles.page}>
      <Toast
        message={
          create.error
            ? failureText(
                create.error,
                "The profile wasn’t saved. Try again in a moment.",
              )
            : ""
        }
        onDismiss={() => create.reset()}
        takeFocus
      />
      <ProfileForm
        heading="Try a level"
        intro="Practice at any grade and pace. Nobody’s record changes, yours included."
        choose={
          <>
            <div className={styles.field}>
              <span className={styles.fieldLabel} id="profile-grade">
                Grade
              </span>
              <GradePicker
                value={grade}
                disabled={create.isPending}
                onChange={(next) => choose({ grade: next, pace })}
              />
              <p className={styles.caption} data-grade-caption>
                {grade === null
                  ? "Choose a grade, from kindergarten to 12th."
                  : `${gradeTitle(grade)}${course ? ` · ${course}` : ""} · starts at ${level(paceLevel(grade, pace))}`}
              </p>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>Pace</span>
              <Segmented
                compact
                label="Pace"
                options={paceOptions}
                value={pace}
                disabled={create.isPending}
                onChange={(next) => choose({ grade: grade ?? 4, pace: next })}
              />
            </div>
          </>
        }
        label={label}
        onLabel={(next) => {
          setNamed(true);
          setLabel(next);
        }}
        levels={levels}
        onLevels={setLevels}
        submit="Start practicing"
        levelsReady={grade !== null}
        pending={create.isPending || create.isSuccess}
        onSubmit={() =>
          create.mutate(
            { label: label.trim(), levels },
            {
              onSuccess: () =>
                void navigate({ to: "/$", params: { _splat: "practice" } }),
            },
          )
        }
      />
    </main>
  );
}

/** `/me/profiles/$profileId`: one saved profile, renamed or adjusted area by
 * area. Saving goes straight back to practicing as it. */
export function EditProfileScreen() {
  const session = currentSession();
  const { profileId } = useParams({ strict: false }) as { profileId: string };
  const me = useQuery(meOptions(session));
  const account = me.data?.signedIn ? me.data : null;
  const profile = account?.practiceProfiles?.find(
    (entry) => entry.id === profileId,
  );
  if (me.isPending)
    return (
      <main className={styles.page}>
        <Loading />
      </main>
    );
  if (!profile)
    return (
      <main className={styles.page}>
        <EmptyState
          title={
            account
              ? "This profile isn’t in your account"
              : "This profile didn’t load"
          }
          action={
            account ? (
              <Link
                to="/$"
                params={{ _splat: "me/profiles/new" }}
                className={buttonClass("primary")}
              >
                Try a level
              </Link>
            ) : (
              <Button variant="primary" onClick={() => void me.refetch()}>
                Try again
              </Button>
            )
          }
        >
          {account
            ? "It may have been deleted. Make a new one at any grade and pace."
            : "Check your connection, then try again."}
        </EmptyState>
      </main>
    );
  return (
    <ProfileEditor
      key={profile.id}
      session={session}
      profile={profile}
      back={leaveTarget(account)}
    />
  );
}

function ProfileEditor({
  session,
  profile,
  back,
}: {
  session: AuthSession;
  profile: { id: string; label: string; levels: ProfileLevels };
  back: ReturnType<typeof leaveTarget>;
}) {
  const navigate = useNavigate();
  const [label, setLabel] = useState(profile.label);
  const [levels, setLevels] = useState(profile.levels);
  const [confirm, setConfirm] = useState(false);
  const update = useUpdateProfile(session, profile.id);
  const remove = useDeleteProfile(session, profile.id);
  const practice = () => {
    // Saving chooses this profile, so practice opens on it.
    choosePracticeProfile(profile.id);
    void navigate({ to: "/$", params: { _splat: "practice" } });
  };
  return (
    <main className={styles.page}>
      <Toast
        message={
          update.error
            ? failureText(
                update.error,
                "Your changes weren’t saved. Try again in a moment.",
              )
            : ""
        }
        onDismiss={() => update.reset()}
        takeFocus
      />
      <ProfileForm
        heading={profile.label}
        intro="Move any area up or down. An area you move starts again there; the rest keep what practice has learned."
        label={label}
        onLabel={(next) => {
          update.reset();
          setLabel(next);
        }}
        levels={levels}
        onLevels={(next) => {
          update.reset();
          setLevels(next);
        }}
        submit="Save and practice"
        pending={update.isPending || remove.isPending}
        onSubmit={() =>
          update.mutate(
            { label: label.trim(), levels },
            { onSuccess: practice },
          )
        }
        aside={
          <Button
            type="button"
            variant="quiet"
            className={styles.delete}
            disabled={update.isPending || remove.isPending}
            onClick={() => setConfirm(true)}
          >
            Delete profile
          </Button>
        }
      />
      <Dialog
        aboveNavigation
        open={confirm}
        title={`Delete ${profile.label}?`}
        onOpenChange={(open) => {
          if (!remove.isPending) {
            setConfirm(open);
            remove.reset();
          }
        }}
      >
        <p className={styles.confirmText}>
          Its levels and the problems practiced as it are deleted. Nobody else’s
          record changes.
        </p>
        <p className={styles.confirmError} role="alert">
          {remove.error
            ? failureText(
                remove.error,
                "The profile wasn’t deleted. Try again in a moment.",
              )
            : ""}
        </p>
        <div className={styles.confirmActions}>
          <Button
            variant="secondary"
            disabled={remove.isPending}
            onClick={() => setConfirm(false)}
          >
            Keep it
          </Button>
          <Button
            variant="primary"
            aria-busy={remove.isPending || undefined}
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  setConfirm(false);
                  // Practicing as it ends: back to their own, or home.
                  const store = useLearnerStore.getState();
                  if (store.learnerId === profile.id)
                    store.select(back.own ?? back.first);
                  void navigate(
                    back.own
                      ? { to: "/$", params: { _splat: "me" } }
                      : { to: "/" },
                  );
                },
              })
            }
          >
            Delete
          </Button>
        </div>
      </Dialog>
    </main>
  );
}
