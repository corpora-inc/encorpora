import { create } from "zustand";

/** Set once when the engine says its records changed under the running app: the app asks for a restart. */
export const useRestart = create<{ message: string | null }>()(() => ({ message: null }));
