import { create } from "zustand";
import { persist } from "zustand/middleware";
import { reportError } from "@appkit/toast.ts";
import { jsonStorage } from "@appkit/storage.ts";
import { call, EngineError } from "../engine/client.ts";
import { photoHash, savePhoto, shrinkImage } from "@appkit/photos.ts";
import type { AskResponse, JobClosed, JobStartParams, JobView, LessonInput, PhotoRef, ResolutionKind } from "../engine/types.ts";
import { useFleet } from "./fleet.ts";

export type ResultInput = { outcome: string } | { value: number; unit: string };

/**
 * Troubleshooting jobs. The engine holds the job and decides every next step;
 * this store keeps the latest view of each job, what the technician has typed
 * but not yet sent (a value, a note), and the "ask" answers for the job.
 */
interface JobsState {
  views: Record<string, JobView>;
  /** A level the technician switched to for viewing, per job. */
  viewLevel: Record<string, string>;
  sending: Record<string, boolean>;
  /** Unsent input, per job and node, kept across reloads. */
  drafts: Record<string, string>;
  notes: Record<string, string>;
  /** Photos taken at a node, kept in IndexedDB; the record keeps path and hash. */
  photos: Record<string, PhotoRef[]>;
  ask: Record<string, { query: string; answer: AskResponse | null }>;
  load(jobId: string): Promise<JobView | null>;
  start(p: JobStartParams): Promise<string | null>;
  answer(jobId: string, input: ResultInput): Promise<void>;
  back(jobId: string): Promise<void>;
  follow(jobId: string): Promise<void>;
  setLevel(jobId: string, level: string): Promise<void>;
  setDraft(key: string, v: string): void;
  setNote(key: string, v: string): void;
  addPhoto(key: string, file: Blob): Promise<void>;
  askQuestion(jobId: string, query: string): Promise<void>;
  close(jobId: string, resolution: ResolutionKind, lesson: LessonInput | null): Promise<JobClosed | null>;
}

export const nodeKey = (jobId: string, nodeId: string) => `${jobId}:${nodeId}`;

/** What went wrong, for the technician: the engine's own message, or a plain one. */
const say = (e: unknown, fallback: string) => (e instanceof EngineError && e.code !== "internal" ? e.message : fallback);

export const useJobs = create<JobsState>()(
  persist(
    (set, get) => {
      const put = (v: JobView) => set({ views: { ...get().views, [v.job.job_id]: v } });
      const busy = (id: string, on: boolean) => set({ sending: { ...get().sending, [id]: on } });
      const after = (v: JobView) => {
        put(v);
        void useFleet.getState().touched(v.job.asset_id);
      };
      return {
        views: {},
        viewLevel: {},
        sending: {},
        drafts: {},
        notes: {},
        photos: {},
        ask: {},
        async load(jobId) {
          try {
            const level = get().viewLevel[jobId];
            const v = await call("job.get", { job_id: jobId, level: level ?? null });
            put(v);
            return v;
          } catch (e) {
            reportError("jobs.load", e, say(e, "This job could not be opened."));
            return null;
          }
        },
        async start(p) {
          try {
            const v = await call("job.start", p);
            after(v);
            return v.job.job_id;
          } catch (e) {
            reportError("jobs.start", e, say(e, "The job could not be started."));
            return null;
          }
        },
        async answer(jobId, input) {
          const v0 = get().views[jobId];
          if (!v0?.step || get().sending[jobId]) return;
          const key = nodeKey(jobId, v0.step.node.node_id);
          busy(jobId, true);
          try {
            const note = get().notes[key] || null;
            const photos = get().photos[key] ?? [];
            const v = await call("job.answer", { job_id: jobId, node_id: v0.step.node.node_id, note, photos, ...input });
            const { [key]: _d, ...drafts } = get().drafts;
            const { [key]: _n, ...notes } = get().notes;
            const { [key]: _p, ...rest } = get().photos;
            set({ drafts, notes, photos: rest });
            after(v);
          } catch (e) {
            reportError("jobs.answer", e, say(e, "The result was not recorded. Try again."));
          } finally {
            busy(jobId, false);
          }
        },
        async back(jobId) {
          if (get().sending[jobId]) return;
          busy(jobId, true);
          try {
            after(await call("job.back", { job_id: jobId }));
          } catch (e) {
            reportError("jobs.back", e, say(e, "The last answer could not be reopened."));
          } finally {
            busy(jobId, false);
          }
        },
        async follow(jobId) {
          if (get().sending[jobId]) return;
          busy(jobId, true);
          try {
            after(await call("job.follow", { job_id: jobId }));
          } catch (e) {
            reportError("jobs.follow", e, say(e, "The job could not continue in that table."));
          } finally {
            busy(jobId, false);
          }
        },
        async setLevel(jobId, level) {
          set({ viewLevel: { ...get().viewLevel, [jobId]: level } });
          await get().load(jobId);
        },
        setDraft: (key, v) => set({ drafts: { ...get().drafts, [key]: v } }),
        setNote: (key, v) => set({ notes: { ...get().notes, [key]: v } }),
        async addPhoto(key, file) {
          try {
            const blob = await shrinkImage(file);
            const sha256 = await photoHash(blob);
            const path = `photos/${sha256}.jpg`;
            await savePhoto(path, blob);
            set({ photos: { ...get().photos, [key]: [...(get().photos[key] ?? []), { path, sha256 }] } });
          } catch (e) {
            reportError("jobs.photo", e, "The photo could not be saved on this device.");
          }
        },
        async askQuestion(jobId, query) {
          const v = get().views[jobId];
          set({ ask: { ...get().ask, [jobId]: { query, answer: null } } });
          try {
            const answer = await call("ask", {
              question: query,
              pack_id: v?.job.pack_id ?? null,
              equip_id: v?.job.equip_id ?? null,
              level: v?.step?.level.id ?? null,
              scope: v ? { tree_id: v.job.tree_id } : null,
            });
            set({ ask: { ...get().ask, [jobId]: { query, answer } } });
          } catch (e) {
            set({ ask: { ...get().ask, [jobId]: { query: "", answer: null } } });
            reportError("jobs.ask", e, say(e, "The question could not be answered."));
          }
        },
        async close(jobId, resolution, lesson) {
          busy(jobId, true);
          try {
            const closed = await call("job.close", { job_id: jobId, resolution, lesson });
            const v = get().views[jobId];
            if (v) put({ ...v, job: closed.job });
            void useFleet.getState().touched(closed.job.asset_id);
            return closed;
          } catch (e) {
            reportError("jobs.close", e, say(e, "The job could not be closed. Your entries are kept."));
            return null;
          } finally {
            busy(jobId, false);
          }
        },
      };
    },
    {
      name: "maint.jobs",
      storage: jsonStorage,
      version: 1,
      // Only what the technician typed is kept; job views are always read fresh from the engine.
      partialize: (s) => ({ drafts: s.drafts, notes: s.notes, photos: s.photos, viewLevel: s.viewLevel }) as unknown as JobsState,
    },
  ),
);
