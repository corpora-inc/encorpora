/**
 * Free-trial funnel events, behind the `track(event, props)` signature of the
 * shared first-party analytics helper (#1134). Until that helper lands this
 * records nothing; it must never block or break the trial.
 */
export type TrialEvent =
  | "try_click"
  | "placement_answer"
  | "placement_done"
  | "map_view"
  | "practice_answer"
  | "lesson_open"
  | "hint_use"
  | "mastery"
  | "session_start"
  | "paywall_view"
  | "paywall_dismiss";
export function track(event: TrialEvent, props?: Record<string, unknown>) {
  void event;
  void props;
}
/** Once per tab session, in the shared helper. */
export function trackSessionStart() {}
