import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Experience } from "../../../schools/classroom-contracts";
import { AppError } from "../../lib/AppError";
import { buttonClass } from "../../ui/Button";
import { Button } from "../../ui/Button";
import { OptionList } from "./OptionList";
import { practiceScopeLine } from "./practice-scope";
import { childrenElsewhere } from "./redirects";
import switches from "../../ui/Switch.module.css";
import { Loading } from "../../ui/Loading";
import { Switch } from "../../ui/Switch";
import { Toast } from "../../ui/Toast";
import { LookSetting } from "../practice/LookSetting";
import {
  practiceSettingsOptions,
  usePracticeAdjustment,
} from "../practice/practice-settings";
import { experienceOptions, useExperienceWrite } from "../school/classroom/api";
import type { FamilyChild } from "./api";
import type { FamilyPlace } from "./FamilyFrame";
import styles from "./Family.module.css";

type Devices = Experience["settings"]["deviceMode"]["value"];

const DEVICES: { value: Devices; label: string; detail: string }[] = [
  {
    value: "shared",
    label: "Shared",
    detail: "Signs out after 30 idle minutes",
  },
  {
    value: "personal",
    label: "Their own",
    detail: "Stays signed in for 90 days",
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
 * Shared or their own devices (the IA v2 spec, §3.5, DeviceModeChoice): the
 * family class's experience setting `deviceMode`, saved on choice. Shared
 * signs out after 30 idle minutes; their own stays signed in for 90 days. In
 * a tutoring group it is the group's, and says so.
 */
export function DeviceModeChoice({ place }: { place: FamilyPlace }) {
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
  // The setting is the family's own class's: its children, not the
  // family's children practicing in another group.
  const elsewhere = childrenElsewhere(place.data?.children ?? [], own.id);
  const inClass = (place.data?.children ?? []).filter(
    (child) => !elsewhere.includes(child),
  );
  const data = experience.data;
  const editable = !!data?.canEdit && !shared;
  const devices = data?.settings.deviceMode.value ?? null;
  return (
    <div className={styles.form} data-practice-defaults="">
      {(shared || elsewhere.length > 0) && (
        <p className={styles.footnote} data-practice-scope="">
          {shared
            ? "Your tutoring group shares these."
            : practiceScopeLine(
                inClass.map((child) => child.name),
                elsewhere.map((child) => child.name),
              )}
        </p>
      )}
      {shared ? (
        <Link
          to="/$"
          params={{ _splat: `school/${own.org}/classes/${own.id}/settings` }}
          className={buttonClass("secondary")}
          style={{ justifySelf: "start" }}
        >
          Open the group’s settings
        </Link>
      ) : experience.isError ? (
        // The saved choice isn't known: no option claims to be it.
        <ReadFailed
          what="Your device setting"
          onRetry={() => void experience.refetch()}
        />
      ) : (
        <div
          aria-busy={experience.isPending || undefined}
          data-practice-choices=""
        >
          <OptionList
            label="Devices"
            options={DEVICES}
            value={devices}
            disabled={!editable}
            busy={write.isPending}
            onChange={(value) =>
              write.mutate(
                { values: { deviceMode: value } },
                {
                  onError: (failure) =>
                    setError(
                      failed(failure, "That change didn’t save. Try again."),
                    ),
                },
              )
            }
          />
        </div>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}

/**
 * One child's own practice settings, on their page: whether a grown-up is
 * working with them (hints read to them, problems paced together), whether
 * they see grade levels on their own screens, and the skill their practice
 * is focused on, which the parent can clear.
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
      | { kind: "together"; enabled: boolean }
      | { kind: "gradeLevel"; shown: boolean }
      | { kind: "focus"; skillId: null },
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
              </span>
              {/* The moving wave where the switch will be, the same width. */}
              <span className={switches.track} data-switch-loading="">
                <Loading inline>{null}</Loading>
              </span>
            </div>
          ) : (
            <Switch
              label="Working together"
              checked={data.workingTogether}
              busy={busy}
              onChange={(on) => void change({ kind: "together", enabled: on })}
            />
          )}
        </div>
      </div>
      {/* Whether this child sees grade levels on their own screens, on any
          device. A grown-up's view always shows them. */}
      {!settings.isError && (
        <div className={styles.setting} data-child-grade-level="">
          <div className={styles.settingText} style={{ gridColumn: "1 / -1" }}>
            {!data ? (
              <div
                className={switches.row}
                aria-busy="true"
                data-switch-wait=""
              >
                <span className={switches.text}>
                  <span>Show grade level</span>
                </span>
                <span className={switches.track} data-switch-loading="">
                  <Loading inline>{null}</Loading>
                </span>
              </div>
            ) : (
              <Switch
                label="Show grade level"
                checked={data.gradeLevelShown}
                busy={busy}
                onChange={(on) =>
                  void change({ kind: "gradeLevel", shown: on })
                }
              />
            )}
          </div>
        </div>
      )}
      {/* How practice looks for this child, on any device. */}
      {!settings.isError && (
        <div className={styles.setting} data-child-look="">
          <div className={styles.settingText} style={{ gridColumn: "1 / -1" }}>
            <LookSetting scope={scope} flush adult />
          </div>
        </div>
      )}
      {data?.focusSkillId && (
        <div className={styles.setting}>
          <div className={styles.settingText}>
            <dt>Focused practice</dt>
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
