import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  experienceValues,
  type Experience,
  type ExperienceKey,
  type NamedScope,
} from "../../../../schools/classroom-contracts";
import {
  experiencePresets,
  type ExperiencePreset,
} from "../../../../schools/setup-contracts";
import { Button } from "../../../ui/Button";
import { Chips } from "../../../ui/Chips";
import { Segmented } from "../../../ui/Segmented";
import { Toast } from "../../../ui/Toast";
import type { AuthSession } from "../../../auth";
import {
  experienceOptions,
  say,
  useExperienceWrite,
  useLeaveOff,
  type ExperienceScope,
} from "./api";
import styles from "./Experience.module.css";

const presets: Record<ExperiencePreset, { title: string; detail: string }> = {
  quiet: {
    title: "Quiet focus",
    detail:
      "Each student sees only their own next problem. No levels, no boards.",
  },
  levels: {
    title: "Levels visible",
    detail: "Students see their own working level as it grows.",
  },
  competition: {
    title: "Friendly competition",
    detail: "Levels show, and the class has a top-10 board for growth.",
  },
};

type Row<K extends ExperienceKey> = {
  key: K;
  title: string;
  options: { value: Experience["settings"][K]["value"]; label: string }[];
  describe: Record<Experience["settings"][K]["value"], string>;
};
const levelsRow: Row<"levels"> = {
  key: "levels",
  title: "Show levels to students",
  options: [
    { value: "hidden", label: "Hidden" },
    { value: "choice", label: "Choice" },
    { value: "shown", label: "Shown" },
  ],
  describe: {
    hidden: "Students never see a grade level.",
    choice: "Each student decides whether to see theirs.",
    shown: "Every student sees their own working level.",
  },
};
const standingsRow: Row<"standings"> = {
  key: "standings",
  title: "Standings",
  options: [
    { value: "off", label: "Off" },
    { value: "class", label: "Class" },
    { value: "school", label: "School" },
    { value: "district", label: "District" },
  ],
  describe: {
    off: "No boards. Students see only their own work.",
    class: "A top-10 board for the class, with names.",
    school: "A top-10 board by grade across the school, with made-up names.",
    district:
      "A top-10 board by grade across the district, with made-up names.",
  },
};
const measureRow: Row<"measure"> = {
  key: "measure",
  title: "What a board counts",
  options: [
    { value: "growth", label: "Growth" },
    { value: "practice", label: "Practice" },
    { value: "level", label: "Level" },
  ],
  describe: {
    growth: "How far each student has come this term.",
    practice: "Problems done without help this term.",
    level: "Each student’s working level.",
  },
};

const whoSet = (setting: {
  setBy: NamedScope | null;
  lockedBy: NamedScope | null;
}) =>
  setting.lockedBy
    ? `Locked by ${setting.lockedBy.name}`
    : setting.setBy
      ? `Set by ${setting.setBy.name}`
      : "AMP’s starting point";

function LockMark({ open = false }: { open?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.lockMark}>
      <rect x="3" y="7" width="10" height="7" rx="1.6" />
      <path
        d={open ? "M5 7V4.8a3 3 0 0 1 5.6-1.4" : "M5 7V4.8a3 3 0 0 1 6 0V7"}
      />
    </svg>
  );
}

function SettingRow<K extends ExperienceKey>({
  row,
  experience,
  disabled,
  note,
  onValue,
  onFollow,
  onLock,
}: {
  row: Row<K>;
  experience: Experience;
  disabled: boolean;
  note?: string;
  onValue: (value: string) => void;
  onFollow: () => void;
  onLock: (locked: boolean) => void;
}) {
  const setting = experience.settings[row.key];
  const lockedAbove =
    !!setting.lockedBy && setting.lockedBy.id !== experience.scope.id;
  const lockedHere =
    !!setting.lockedBy && setting.lockedBy.id === experience.scope.id;
  const fixed = !experience.canEdit || lockedAbove;
  const value = setting.value as string;
  const options = (row.options as { value: string; label: string }[]).filter(
    (option) =>
      row.key !== "standings" ||
      experience.standingsOptions.includes(option.value as never) ||
      option.value === value,
  );
  const describe = row.describe as Record<string, string>;
  return (
    <section className={styles.row} aria-labelledby={`setting-${row.key}`}>
      <div className={styles.rowText}>
        <h2 id={`setting-${row.key}`}>{row.title}</h2>
        <p>{note ?? describe[value]}</p>
      </div>
      <div className={styles.rowControl}>
        <Segmented
          label={row.title}
          options={options}
          value={value}
          compact
          dense
          disabled={fixed || disabled}
          onChange={(next) => {
            if (next !== value) onValue(next);
          }}
        />
        <div className={styles.rowMeta}>
          <span className={styles.who} data-locked={lockedAbove || undefined}>
            {lockedAbove && <LockMark />}
            {whoSet(setting)}
          </span>
          {!fixed && setting.own && experience.scope.kind === "class" && (
            <Button variant="quiet" disabled={disabled} onClick={onFollow}>
              {setting.inherited.from
                ? `Follow ${setting.inherited.from.name}`
                : "Use AMP’s starting point"}
            </Button>
          )}
          {experience.canLock && !lockedAbove && (
            <Button
              variant="quiet"
              className={styles.lock}
              aria-pressed={lockedHere}
              disabled={disabled}
              onClick={() => onLock(!lockedHere)}
            >
              <LockMark open={!lockedHere} />
              {lockedHere
                ? "Locked for everyone below"
                : "Lock for everyone below"}
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/** One screen at any scope: what students see, who decided, and what this person
 * can change. A choice shows at once and saves itself. */
export function ExperienceSettings({
  session,
  scope,
  experience,
}: {
  session: AuthSession | null;
  scope: ExperienceScope;
  experience: Experience;
}) {
  const write = useExperienceWrite(session, scope);
  const leaveOff = useLeaveOff(session, scope.id);
  const [error, setError] = useState("");
  const send = (body: Parameters<typeof write.mutate>[0]) =>
    write.mutate(body, {
      onError: (failure) => setError(say(failure, "That change didn’t save.")),
    });
  const { settings } = experience;
  const current = (Object.keys(experienceValues) as ExperiencePreset[]).find(
    (preset) =>
      (Object.keys(experienceValues[preset]) as ExperienceKey[]).every(
        (key) => settings[key].value === experienceValues[preset][key],
      ),
  );
  const lockedKeys = (Object.keys(settings) as ExperienceKey[]).filter(
    (key) =>
      settings[key].lockedBy &&
      settings[key].lockedBy.id !== experience.scope.id,
  );
  /** A choice a lock above rules out isn't offered as one. */
  const blockedBy = (preset: ExperiencePreset) =>
    lockedKeys.find(
      (key) => settings[key].value !== experienceValues[preset][key],
    );
  const choose = (preset: ExperiencePreset) => {
    const wanted = experienceValues[preset];
    send({
      values: Object.fromEntries(
        (Object.keys(wanted) as ExperienceKey[])
          .filter((key) => !lockedKeys.includes(key))
          .map((key) => [key, wanted[key]]),
      ),
    });
  };
  const levelsShown = settings.levels.value === "shown";
  const row = (key: ExperienceKey) => (
    <SettingRow
      key={key}
      row={
        (key === "levels"
          ? levelsRow
          : key === "standings"
            ? standingsRow
            : measureRow) as Row<ExperienceKey>
      }
      experience={experience}
      disabled={false}
      {...(key === "measure" &&
      settings.measure.value === "level" &&
      !levelsShown
        ? { note: "Levels aren’t shown here, so boards count growth." }
        : {})}
      onValue={(value) => send({ values: { [key]: value } })}
      onFollow={() => send({ values: { [key]: null } })}
      onLock={(locked) =>
        send({
          locks: { [key]: locked },
          // A lock holds this scope's own choice, whatever it's showing.
          ...(locked && !settings[key].own
            ? { values: { [key]: settings[key].value } }
            : {}),
        })
      }
    />
  );
  return (
    <div className={styles.page}>
      {experience.canEdit ? null : (
        <p className={styles.readOnly}>
          {experience.scope.kind === "org"
            ? "A school admin changes these. Each class can choose its own from its Student experience tab, unless it’s locked here."
            : "This class’s teacher changes these."}
        </p>
      )}
      <div className={styles.presets} role="group" aria-label="Starting points">
        {experiencePresets.map((preset) => {
          const blocked = blockedBy(preset);
          return (
            <button
              key={preset}
              type="button"
              aria-pressed={current === preset}
              disabled={!experience.canEdit || !!blocked}
              className={styles.preset}
              onClick={() => {
                if (current !== preset) choose(preset);
              }}
            >
              <span className={styles.presetTitle}>
                {presets[preset].title}
              </span>
              <span className={styles.presetDetail}>
                {blocked
                  ? `${settings[blocked].lockedBy!.name} locked this choice out.`
                  : presets[preset].detail}
              </span>
            </button>
          );
        })}
      </div>
      <div className={styles.rows}>
        {row("levels")}
        {row("standings")}
        {row("measure")}
      </div>
      {experience.students && (
        <section className={styles.leftOff} aria-labelledby="left-off">
          <div className={styles.rowText}>
            <h2 id="left-off">Leave off standings</h2>
            <p>
              A student left off isn’t on any board and doesn’t see one. Their
              practice and grades don’t change.
            </p>
          </div>
          {experience.students.length ? (
            <Chips
              label="Students left off standings"
              disabled={!experience.canEdit}
              options={experience.students.map((student) => ({
                value: student.id,
                label: student.name,
              }))}
              value={experience.students
                .filter((student) => student.leftOff)
                .map((student) => student.id)}
              onChange={(next) => {
                const chosen = new Set(next);
                const changed = experience.students!.find(
                  (student) => student.leftOff !== chosen.has(student.id),
                );
                if (changed)
                  leaveOff.mutate(
                    { id: changed.id, leftOff: chosen.has(changed.id) },
                    {
                      onError: (failure) =>
                        setError(say(failure, "That change didn’t save.")),
                    },
                  );
              }}
            />
          ) : (
            <p className={styles.none}>
              Students added to this class show here.
            </p>
          )}
        </section>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </div>
  );
}

/** Keeps the class's left-off list in the one store the roster also reads. */
export const useClassExperience = (
  session: AuthSession | null,
  classId: string,
) => useQuery(experienceOptions(session, { kind: "class", id: classId }));
