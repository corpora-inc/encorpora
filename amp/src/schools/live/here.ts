import type { Pool } from "pg";
import { readLiveRows, readSeen } from "./rows.js";
import { openSession } from "./sessions.js";
import { isHere } from "./status.js";

/**
 * Who is here in a class now, by person: the one rule the cockpit's rows,
 * its Here total and the wall board share (`isHere`, status.ts).
 *
 * With a session running each student's live row is judged: something of
 * theirs in the session, or their own sign-in seen in the last ten minutes.
 * With none running there is no session to be in, so it is the last ten
 * minutes alone. Never "seen today": a student who practiced this morning,
 * or whose sign-in a seed dated an hour ago, is not here.
 */
export async function readHere(
  pool: Pool,
  classId: string,
): Promise<Set<string>> {
  const session = await openSession(pool, classId);
  const rows = session
    ? await readLiveRows(pool, {
        classId,
        sessionId: session.id,
        from: session.startedAt,
        to: session.endsAt,
      })
    : await readSeen(pool, classId);
  const now = (await pool.query("SELECT now() AS now")).rows[0].now as Date;
  const at = { now, startedAt: session?.startedAt ?? now.toISOString() };
  return new Set(
    rows.filter((row) => isHere(row, at)).map((row) => row.personId),
  );
}
