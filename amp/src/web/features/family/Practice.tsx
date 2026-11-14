import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Experience } from "../../../schools/classroom-contracts";
import { AppError } from "../../lib/AppError";
import { buttonClass } from "../../ui/Button";
import { Button } from "../../ui/Button";
import { OptionList } from "./OptionList";
import switches from "../../ui/Switch.module.css";
import { Loading } from "../../ui/Loading";
import { Switch } from "../../ui/Switch";
import { Toast } from "../../ui/Toast";
import {
  practiceSettingsOptions,
  usePracticeAdjustment,
} from "../practice/practice-settings";
import { experienceOptions, useExperienceWrite } from "../school/classroom/api";
import type { FamilyChild } from "./api";
import type { FamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";

type Levels = Experience["settings"]["levels"]["value"];
type Devices = Experience["settings"]["deviceMode"]["value"];

const LEVELS: { value: Levels; label: string; detail: string }[] = [
  {
    value: "hidden",
    label: "Hidden",
    detail: "Your kids never see a grade level while they practice.",
  },
  {
    value: "choice",
    label: "Their choice",
    detail: "Each child decides whether to see their own level.",
  },
  {
    value: "shown",
    label: "Shown",
    detail: "Each child sees their own working level as it grows.",
  },
];
const DEVICES: { value: Devices; label: string; detail: string }[] = [
  {
    value: "shared",
    label: "Shared",
    detail: "On a shared device a child is signed out after 30 idle minutes.",
  },
  {
    value: "personal",
    label: "Their own",
    detail: "On their own device a child stays signed in for 90 days.",
  },
];

/** A setting's saved value didn't load: said in place, with the way to try
 * again, and logged. Never a control showing a value that isn't known. */
function ReadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className={styles.readFailed} role="alert" data-read-failed="">
      <p>{what} didn’t load. Check your connection, then try again.</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

const failed = (failure: unknown, fallback: string) =>
  failure instanceof AppError && failure.message ? failure.message : fallback;

/**
 * The family's practice defaults (`/family/<family>/settings`): what every
 * child sees while practicing, now and as children are added, and how long a
 * child stays signed in on a device. They are the family's own class's
 * settings, so a class that also holds other families' children sets them
 * with the tutoring group, for everyone in it. Never standings or boards.
 */
export function FamilyPracticeDefaults({ place }: { place: FamilyPlace }) {
  const own = place.own;
  const scope = { kind: "class", id: own?.id ?? "" } as const;
  const experience = useQuery({
    ...experienceOptions(place.session, scope),
    enabled: !!own,
  });
  const write = useExperienceWrite(place.session, scope);
  const [error, setError] = useState("");
  useEffect(() => {
    if (experience.isError)
      console.error(
        "The family's practice settings didn't load",
        experience.error,
      );
  }, [experience.isError, experience.error]);
  if (!own) return null;
  const shared = !!place.data?.teachingPlace;
  const data = experience.data;
  const editable = !!data?.canEdit && !shared;
  const set = (key: "levels" | "deviceMode", value: string) =>
    write.mutate(
      { values: { [key]: value } },
      {
        onError: (failure) =>
          setError(failed(failure, "That change didn’t save. Try again.")),
      },
    );
  const levels = data?.settings.levels.value ?? null;
  const devices = data?.settings.deviceMode.value ?? null;
  return (
    <section
      className={styles.section}
      aria-labelledby="family-practice"
      data-practice-defaults=""
    >
      <h2 id="family-practice">Practice</h2>
      <p className={styles.footnote}>
        {shared
          ? "Your tutoring group shares these, so they’re set with the group, for everyone in it."
          : "For every child in the family, and each child you add. The math is the same either way."}
      </p>
      {shared ? (
        <Link
          to="/$"
          params={{ _splat: `school/${own.org}/classes/${own.id}/settings` }}
          className={buttonClass("secondary")}
          style={{ justifySelf: "start" }}
        >
          Open the group’s settings
        </Link>
      ) : (
        <div
          className={styles.form}
          aria-busy={experience.isPending || undefined}
          data-practice-choices=""
        >
          {experience.isError ? (
            // The saved choices aren't known: no option claims to be one.
            <ReadFailed
              what="Your practice settings"
              onRetry={() => void experience.refetch()}
            />
          ) : (
            <>
              <div>
                <h3 className={styles.label} id="practice-levels">
                  Grade levels{" "}
                  {/* The saved choices are on their way: the wave beside the
                      heading, the lists already in their places. */}
                  {experience.isPending && (
                    <Loading inline>Reading what’s saved</Loading>
                  )}
                </h3>
                <OptionList
                  label="Grade levels"
                  options={LEVELS}
                  value={levels}
                  disabled={!editable}
                  busy={write.isPending}
                  onChange={(value) => set("levels", value)}
                />
              </div>
              <div>
                <h3 className={styles.label} id="practice-devices">
                  Devices
                </h3>
                <OptionList
                  label="Devices"
                  options={DEVICES}
                  value={devices}
                  disabled={!editable}
                  busy={write.isPending}
                  onChange={(value) => set("deviceMode", value)}
                />
              </div>
            </>
          )}
        </div>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}

/**
 * One child's own practice settings, on their page: whether a grown-up is
 * working with them (hints read to them, problems paced together) and the
 * skill their practice is focused on, which the parent can clear.
 */
export function ChildPracticeSettings({
  place,
  child,
}: {
  place: FamilyPlace;
  child: FamilyChild;
}) {
  const scope = {
    identity: place.session.accountId,
    learnerId: child.id,
    token: place.session.token,
  };
  const settings = useQuery(practiceSettingsOptions(scope));
  const adjust = usePracticeAdjustment(scope);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = async (
    intent:
      { kind: "together"; enabled: boolean } | { kind: "focus"; skillId: null },
  ) => {
    setBusy(true);
    try {
      await adjust.change(intent);
    } catch (failure) {
      console.error("A practice setting didn’t save", failure);
      setError(failed(failure, "That change didn’t save. Try again."));
    } finally {
      setBusy(false);
    }
  };
  const data = settings.data;
  useEffect(() => {
    if (settings.isError)
      console.error(
        `${child.name}'s practice settings didn't load`,
        settings.error,
      );
  }, [settings.isError, settings.error, child.name]);
  return (
    <>
      <div className={styles.setting} data-child-practice="">
        <div className={styles.settingText} style={{ gridColumn: "1 / -1" }}>
          {settings.isError ? (
            // Whether a grown-up is working with them isn't known: no switch
            // says it is or isn't.
            <ReadFailed
              what={`${child.name}’s practice settings`}
              onRetry={() => void settings.refetch()}
            />
          ) : !data ? (
            // Until it is read, its place is held and no state is claimed.
            <div className={switches.row} aria-busy="true" data-switch-wait="">
              <span className={switches.text}>
                <span>Working together</span>
                <small className={switches.detail}>
                  A grown-up is helping {child.name} with these problems
                </small>
              </span>
              <span
                className={switches.track}
                style={{ visibility: "hidden" }}
              />
            </div>
          ) : (
            <Switch
              label="Working together"
              detail={`A grown-up is helping ${child.name} with these problems`}
              checked={data.workingTogether}
              busy={busy}
              onChange={(on) => void change({ kind: "together", enabled: on })}
            />
          )}
        </div>
      </div>
      {data?.focusSkillId && (
        <div className={styles.setting}>
          <div className={styles.settingText}>
            <dt>Focused practice</dt>
            <dd>One skill at a time, until it’s cleared</dd>
          </div>
          <div className={styles.settingAction}>
            <button
              type="button"
              className={buttonClass("secondary")}
              disabled={busy}
              onClick={() => void change({ kind: "focus", skillId: null })}
            >
              Clear focus
            </button>
          </div>
        </div>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </>
  );
}
