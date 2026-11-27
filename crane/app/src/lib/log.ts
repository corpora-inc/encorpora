/** Every error is logged: to the console and to a small on-device ring buffer. */
const KEY = "crane.errors";
const MAX = 50;

export interface LoggedError {
  at: string;
  where: string;
  message: string;
}

export function logError(where: string, error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[${where}]`, error);
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]") as LoggedError[];
    list.push({ at: new Date().toISOString(), where, message });
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
  } catch (e) {
    console.error("[log] could not persist error", e);
  }
}

export function loggedErrors(): LoggedError[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as LoggedError[];
  } catch (e) {
    console.error("[log] could not read errors", e);
    return [];
  }
}
