/** Private, loopback-only preview state. Never use this for a real payment gateway. */
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, isAbsolute } from "node:path";
import type { AnnualPayment } from "../src/billing/stripe/model";

export type PreviewSession = {
  status: "open" | "complete" | "expired";
  subscriptionId?: string;
  url: string | null;
};
export type PreviewState = {
  version: 1;
  schema: string;
  accountsSecret: string;
  approvalsSecret: string;
  schoolSecret: string;
  consentSecret: string;
  payments: [string, AnnualPayment][];
  sessions: [string, PreviewSession][];
};
export const previewSchema = (schema: string) =>
  /^purchase_preview_[a-z0-9_]+$/.test(schema);

export async function previewState(path?: string, schema?: string) {
  let saved: PreviewState | undefined;
  if (path) {
    if (!isAbsolute(path))
      throw new Error(
        "The preview state file must use an absolute private path.",
      );
    try {
      saved = JSON.parse(await readFile(path, "utf8")) as PreviewState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  if (saved) {
    if (
      saved.version !== 1 ||
      !previewSchema(saved.schema) ||
      ![
        saved.accountsSecret,
        saved.approvalsSecret,
        saved.schoolSecret,
        saved.consentSecret,
      ].every((secret) => /^[a-f0-9]{64}$/.test(secret)) ||
      !Array.isArray(saved.payments) ||
      !Array.isArray(saved.sessions)
    )
      throw new Error("The preview state file is invalid.");
    if (schema && schema !== saved.schema)
      throw new Error("The preview schema differs from its saved state.");
  }
  const state: PreviewState = saved ?? {
    version: 1,
    schema: schema ?? `purchase_preview_${randomUUID().replaceAll("-", "")}`,
    accountsSecret: randomBytes(32).toString("hex"),
    approvalsSecret: randomBytes(32).toString("hex"),
    schoolSecret: randomBytes(32).toString("hex"),
    consentSecret: randomBytes(32).toString("hex"),
    payments: [],
    sessions: [],
  };
  if (!previewSchema(state.schema)) throw new Error("Invalid preview schema.");
  let writes = Promise.resolve();
  const persist = () => {
    if (!path) return Promise.resolve();
    writes = writes.then(async () => {
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, path);
    });
    return writes;
  };
  return { state, existed: !!saved, persist };
}
