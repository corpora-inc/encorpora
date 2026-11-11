import { SettingMeta } from "./SettingMeta";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { WEEKLY_TARGET_RANGE } from "../../../../schools/classroom-contracts";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Loading } from "../../../ui/Loading";
import { Stepper } from "../../../ui/Stepper";
import { Toast } from "../../../ui/Toast";
import { useStaffSession } from "../classes/api";
import { say, useWeeklyTargetWrite, weeklyTargetOptions } from "./api";
import rows from "./Experience.module.css";
import styles from "../School.module.css";

const minutesWords = (minutes: number) => `${minutes} min`;

/** A school's or district's weekly practice target, a section of its
 * Settings: one number every class follows unless it sets its own. It is the
 * midpoint of the practice heat maps and the grade suggestion's practice
 * scale. A step shows at once and saves once stepping settles. */
export function WeeklyTargetSection({ orgId }: { orgId: string }) {
  const session = useStaffSession();
  const target = useQuery(weeklyTargetOptions(session, orgId));
  const save = useWeeklyTargetWrite(session, orgId);
  const [error, setError] = useState("");
  const stored = target.data?.minutes ?? WEEKLY_TARGET_RANGE.min;
  const [value, setValue] = useState(stored);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!timer.current && !save.isPending) setValue(stored);
  }, [stored, save.isPending]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const send = (minutes: number | null) =>
    save.mutate(minutes, {
      onError: (failure) => {
        setValue(stored);
        setError(say(failure, "The weekly target didn’t save."));
      },
    });
  const data = target.data;
  const fixed = !data?.canEdit || !!data?.lockedBy;
  return (
    <section className={styles.settingsSection} aria-labelledby="weekly-target">
      <h2 id="weekly-target">Weekly practice</h2>
      <p className={styles.sectionLead}>
        Minutes per student per week. Every class follows it unless the class
        sets its own.
      </p>
      {data ? (
        <div className={rows.rows}>
          <section className={rows.row} aria-labelledby="setting-target">
            <div className={rows.rowText}>
              <h2 id="setting-target">Weekly target per student</h2>
              <p>
                The midpoint of the practice heat map’s scale, and the basis for
                practice in suggested grades.
              </p>
            </div>
            <div className={rows.rowControl}>
              {fixed ? (
                <p className={rows.readOnly}>
                  {minutesWords(data.minutes ?? 0)} a week
                </p>
              ) : (
                <Stepper
                  label="Minutes a week"
                  value={value}
                  min={WEEKLY_TARGET_RANGE.min}
                  max={WEEKLY_TARGET_RANGE.max}
                  step={WEEKLY_TARGET_RANGE.step}
                  format={minutesWords}
                  onChange={(next) => {
                    setValue(next);
                    clearTimeout(timer.current);
                    timer.current = setTimeout(() => {
                      timer.current = undefined;
                      send(next);
                    }, 400);
                  }}
                />
              )}
              <SettingMeta
                scope="org"
                own={!!data.own}
                setBy={data.setBy ?? null}
                lockedAbove={data.lockedBy ?? null}
                reset={
                  !fixed && data.own
                    ? {
                        label:
                          data.inherited === null
                            ? "Clear"
                            : `Use ${minutesWords(data.inherited)}`,
                        onClick: () => {
                          clearTimeout(timer.current);
                          timer.current = undefined;
                          send(null);
                        },
                      }
                    : undefined
                }
              />
            </div>
          </section>
        </div>
      ) : target.isPending ? (
        <Loading>Loading the weekly target…</Loading>
      ) : (
        <EmptyState
          title="The weekly target didn’t load"
          action={
            <Button variant="primary" onClick={() => void target.refetch()}>
              Try again
            </Button>
          }
        >
          {say(target.error, "The weekly target didn’t load.")}
        </EmptyState>
      )}
      <Toast message={error} onDismiss={() => setError("")} />
    </section>
  );
}
