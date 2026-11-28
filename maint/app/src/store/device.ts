import { create } from "zustand";

/** Device capabilities, resolved once at boot so controls never pop in later. */
export const useDevice = create<{ voice: boolean; assistantModel: string | null }>()(() => ({ voice: false, assistantModel: null }));
