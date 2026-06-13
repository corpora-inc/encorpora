/**
 * beatlounge — useRtl: the pack's writing direction for the bits that need it in
 * JS (not just CSS). Most RTL flips happen for free off an ancestor `dir="rtl"`
 * + CSS logical properties; this hook is for surfaces whose POINTER MATH must
 * mirror too (the performance ribbon: a touch on the left must resolve to the
 * pitch shown on the left once the ribbon is flipped). Driven by the native UI
 * language (the same source the Shell stamps `dir` from), so it's stable for the
 * pack instance's lifetime and needs no DOM read.
 */

import { uiDir } from "../../i18n/strings"

/** True when the pack renders right-to-left (native language is RTL). */
export const useRtl = (): boolean => uiDir() === "rtl"
