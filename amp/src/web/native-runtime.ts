import { isTauri } from "@tauri-apps/api/core";

/** Detection is independent of deployment variables and cannot enable native auth. */
export const nativeRuntime = isTauri();
