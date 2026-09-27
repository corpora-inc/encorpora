import type {
  ActivityRecord,
  AttemptRecord,
  DisputeRecord,
  Json,
  LocalRepository,
  Profile,
  StoredSession,
} from "../storage";
/** Deliberately ephemeral browser preview. Never selected as a native fallback. */
export function previewRepository(): LocalRepository {
  const profiles = new Map<string, Profile>();
  const sessions = new Map<string, StoredSession>();
  const activities = new Map<string, ActivityRecord[]>();
  const attempts = new Map<string, AttemptRecord[]>();
  const disputes = new Map<string, DisputeRecord[]>();
  const snapshots = new Map<string, Json>();
  const journal = new Map<string, Json>();
  const clone = <T>(v: T): T => structuredClone(v);
  const unsupported = async (): Promise<never> => {
    throw new Error(
      "Backup and restore require the native app. Browser preview is temporary.",
    );
  };
  return {
    listProfiles: async () => clone([...profiles.values()]),
    saveProfile: async (p) => {
      profiles.set(p.id, clone(p));
    },
    deleteProfile: async (id) => {
      profiles.delete(id);
      sessions.delete(id);
      activities.delete(id);
      attempts.delete(id);
      disputes.delete(id);
      snapshots.delete(id);
    },
    loadSession: async (id) => clone(sessions.get(id) ?? null),
    saveSession: async (id, s) => {
      sessions.set(id, clone(s));
    },
    saveActivity: async (id, a) => {
      const list = activities.get(id) ?? [];
      if (!list.some((old) => old.id === a.id)) list.push(clone(a));
      activities.set(id, list);
    },
    listActivities: async (id) => clone(activities.get(id) ?? []),
    recordAttempt: async (id, a, s) => {
      const list = attempts.get(id) ?? [];
      if (list.some((old) => old.id === a.id))
        return { inserted: false, snapshot: clone(snapshots.get(id) ?? null) };
      if (
        list.some((old) => old.activityId === a.activityId) ||
        (disputes.get(id) ?? []).some((d) => d.activityId === a.activityId)
      )
        throw new Error("This activity already has evidence or is disputed.");
      list.push(clone(a));
      attempts.set(id, list);
      snapshots.set(id, clone(s));
      return { inserted: true, snapshot: clone(s) };
    },
    recordDispute: async (id, d, s) => {
      const list = disputes.get(id) ?? [];
      if (!list.some((old) => old.id === d.id)) {
        list.push(clone(d));
        disputes.set(id, list);
        snapshots.set(id, clone(s));
      }
    },
    listDisputes: async (id) => clone(disputes.get(id) ?? []),
    listAttempts: async (id) => clone(attempts.get(id) ?? []),
    loadSnapshot: async (id) => clone(snapshots.get(id) ?? null),
    getJournal: async (key) => clone(journal.get(key) ?? null),
    putJournal: async (key, data) => {
      journal.set(key, clone(data));
    },
    deleteJournal: async (key) => {
      journal.delete(key);
    },
    exportBackup: unsupported,
    restoreBackup: unsupported,
    shareBackup: unsupported,
    pickBackup: unsupported,
    getRecoveryBackup: async () => null,
    deleteAccount: async () => {
      profiles.clear();
      sessions.clear();
      activities.clear();
      attempts.clear();
      disputes.clear();
      snapshots.clear();
      journal.clear();
    },
  };
}
