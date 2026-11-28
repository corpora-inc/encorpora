import { create } from "zustand";

/** Device capabilities, resolved once at boot so controls never pop in later. */
/** `hub`: this screen can reach a hub's review API (a supervisor's or engineer's screen). */
export const useDevice = create<{ voice: boolean; hub: boolean }>()(() => ({ voice: false, hub: false }));
