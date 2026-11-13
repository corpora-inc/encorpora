import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { z } from "zod";
import { adultPracticeEnd } from "./adult-access.js";
import { FamilyError } from "../family/contracts.js";
import type { FamilyRepository } from "../family/repository.js";
import { familyHasLearnerRoom } from "../learning/free-allowance.js";
import { initialLevel } from "../learning/frontier.js";
import {
  defaultPracticeSettings,
  practiceSettingsSchema,
  type PracticeSettings,
} from "../learning/practice-settings.js";
import {
  profileStrands,
  roundedLevels,
  type createProfileSchema,
  type PracticeProfile,
  type ProfileLevels,
  type updateProfileSchema,
} from "../learning/practice-profiles.js";
import {
  startingLevels,
  type StartingChoice,
} from "../learning/starting-point.js";

/* Practice profiles (docs/families.md): an adult practices as someone else.
   A profile is a learner owned by the adult's account, marked adult (no birth
   year, no parental consent: this is the adult's own practice) and marked as a
   simulation. Its name is the label the adult gave it. Its starting levels are
   its practice settings' strand starts, the same seeding "Easier" uses, so
   practice adapts from the first answer as for any learner. It holds nothing
   about anyone else: copying a student copies whole levels, never a name.

   It is never one of the family's children, a roster's student, the
   account's own adult learner or a purchase's learner. It has no grant of its
   own: it practices while the account has paid or licensed access of any kind
   (`profilesCovered`), and otherwise on its own free allowance. */

type Database = Pick<PoolClient, "query">;

/** SQL: this learner id (an internal SQL expression) is a practice profile,
 * which no report or follow-up counts as anyone's learning. */
export const simulationLearnerSql = (learner: string) =>
  `EXISTS(SELECT 1 FROM amp_learners sim_learner WHERE sim_learner.id=${learner} AND sim_learner.simulation)`;

/** Whether the account's paid or licensed access covers its profiles: a
 * plan or gift on its own adult learner, its children's access, a licensed
 * school where it teaches, or the children of a family it is the second
 * parent of. Read live from those sources, never from the derived `adult:`
 * grant, so a refunded plan or a revoked license stops covering on the next
 * request. */
export async function profilesCovered(
  db: Database,
  accountId: string,
): Promise<boolean> {
  const own = await db.query(
    `SELECT 1 FROM amp_learners a JOIN amp_grants g ON g.learner_id=a.id
     WHERE a.account_id=$1 AND a.adult AND NOT a.simulation AND a.deleted_at IS NULL
       AND g.id NOT LIKE 'adult:%'
       AND g.status='active' AND g.starts_at<=now() AND g.ends_at>now() LIMIT 1`,
    [accountId],
  );
  return !!own.rowCount || (await adultPracticeEnd(db, accountId)) !== null;
}

/** The starting choice closest to a profile's levels, for the overall
 * estimate its strands are read beside. Ties take the lower start. */
function nearestStart(levels: ProfileLevels): StartingChoice {
  const sorted = Object.values(levels).sort((a, b) => a - b);
  const middle = sorted[Math.floor((sorted.length - 1) / 2)]!;
  return (Object.entries(startingLevels) as [StartingChoice, number][]).sort(
    ([, a], [, b]) => Math.abs(a - middle) - Math.abs(b - middle) || a - b,
  )[0]![0];
}

/** A profile's levels from its strand starts: whole levels on the grade
 * axis. A strand "Easier" moved below a whole level reads as its nearest. */
function levelsOf(
  settings: PracticeSettings | null,
  band: StartingChoice | null,
): ProfileLevels {
  const overall = initialLevel({ band, adult: true });
  return roundedLevels(
    overall,
    Object.fromEntries(
      Object.entries(settings?.strandStarts ?? {}).map(([strand, start]) => [
        strand,
        start.level,
      ]),
    ),
  );
}

/** The account's live profiles, newest first. */
export async function listProfiles(
  db: Database,
  accountId: string,
): Promise<PracticeProfile[]> {
  const { rows } = await db.query<{
    id: string;
    name: string;
    band: StartingChoice | null;
    state: unknown;
  }>(
    `SELECT l.id,l.name,l.starting_band AS band,s.state FROM amp_learners l
     LEFT JOIN amp_practice_settings s ON s.learner_id=l.id
     WHERE l.account_id=$1 AND l.simulation AND l.deleted_at IS NULL
     ORDER BY l.created_at DESC,l.id`,
    [accountId],
  );
  return rows.map((row) => {
    const settings = row.state
      ? practiceSettingsSchema.safeParse(row.state)
      : null;
    return {
      id: row.id,
      label: row.name,
      levels: levelsOf(settings?.success ? settings.data : null, row.band),
    };
  });
}

/** Makes a profile from a label and starting levels. Every strand starts at
 * its level from the first answer. */
export async function createProfile(
  families: FamilyRepository,
  accountId: string,
  input: z.infer<typeof createProfileSchema>,
): Promise<{ learnerId: string }> {
  return families.transaction(accountId, async (client) => {
    // The one sanity limit: live learners per account, profiles included.
    if (!(await familyHasLearnerRoom(client, accountId)))
      throw new FamilyError(403, "too_many_learners");
    const learnerId = randomUUID();
    // A starting point is all three or none (amp_starting_point_valid).
    await client.query(
      `INSERT INTO amp_learners(id,account_id,name,adult,simulation,starting_band,starting_policy,starting_excluded_strands)
       VALUES($1,$2,$3,true,true,$4,1,ARRAY[]::text[])`,
      [learnerId, accountId, input.label, nearestStart(input.levels)],
    );
    const settings: PracticeSettings = {
      ...defaultPracticeSettings(),
      strandStarts: Object.fromEntries(
        profileStrands.map((strand) => [
          strand,
          { level: input.levels[strand], revision: 0 },
        ]),
      ),
    };
    await client.query(
      "INSERT INTO amp_practice_settings(learner_id,state) VALUES($1,$2)",
      [learnerId, JSON.stringify(settings)],
    );
    return { learnerId };
  });
}

/** Renames a profile, or moves strands: each strand whose level changes
 * starts again there from the next problem, as "Easier" does; the rest keep
 * what practice has learned. Sending the same levels again changes nothing. */
export async function updateProfile(
  families: FamilyRepository,
  accountId: string,
  learnerId: string,
  input: z.infer<typeof updateProfileSchema>,
): Promise<PracticeProfile> {
  return families.transaction(accountId, async (client) => {
    const found = await client.query<{ band: StartingChoice | null }>(
      `SELECT starting_band AS band FROM amp_learners
       WHERE id=$1 AND account_id=$2 AND simulation AND deleted_at IS NULL FOR UPDATE`,
      [learnerId, accountId],
    );
    if (!found.rowCount) throw new FamilyError(404, "profile_not_found");
    if (input.label !== undefined)
      await client.query("UPDATE amp_learners SET name=$2 WHERE id=$1", [
        learnerId,
        input.label,
      ]);
    const stored = (
      await client.query<{ state: unknown }>(
        "SELECT state FROM amp_practice_settings WHERE learner_id=$1 FOR UPDATE",
        [learnerId],
      )
    ).rows[0];
    const previous = stored
      ? practiceSettingsSchema.parse(stored.state)
      : defaultPracticeSettings();
    const band = found.rows[0]!.band;
    let settings = previous;
    if (input.levels) {
      const current = levelsOf(previous, band);
      const moved = profileStrands.filter(
        (strand) => current[strand] !== input.levels![strand],
      );
      if (moved.length) {
        const revision = previous.revision + 1;
        settings = {
          ...previous,
          revision,
          // A chosen focus belongs to the levels it was chosen at.
          focusSkillId: null,
          strandStarts: {
            ...previous.strandStarts,
            ...Object.fromEntries(
              moved.map((strand) => [
                strand,
                { level: input.levels![strand], revision },
              ]),
            ),
          },
        };
        await client.query(
          `INSERT INTO amp_practice_settings(learner_id,state) VALUES($1,$2)
           ON CONFLICT(learner_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()`,
          [learnerId, JSON.stringify(settings)],
        );
      }
    }
    const label = (
      await client.query<{ name: string }>(
        "SELECT name FROM amp_learners WHERE id=$1",
        [learnerId],
      )
    ).rows[0]!.name;
    return { id: learnerId, label, levels: levelsOf(settings, band) };
  });
}

/** Deletes a profile and everything it practiced. A problem report it filed
 * stays, as a deleted learner's does, without its note. */
export async function deleteProfile(
  families: FamilyRepository,
  accountId: string,
  learnerId: string,
): Promise<void> {
  await families.transaction(accountId, async (client) => {
    const found = await client.query(
      "SELECT 1 FROM amp_learners WHERE id=$1 AND account_id=$2 AND simulation FOR UPDATE",
      [learnerId, accountId],
    );
    if (!found.rowCount) throw new FamilyError(404, "profile_not_found");
    await client.query(
      "UPDATE amp_problem_flags SET learner_id=NULL,note=NULL WHERE learner_id=$1",
      [learnerId],
    );
    await client.query("DELETE FROM amp_learners WHERE id=$1", [learnerId]);
    await families.audit(
      client,
      accountId,
      "learner.learning-deleted",
      learnerId,
      1,
    );
  });
}

/** A student's levels now, as their record reads them: their latest stored
 * level, each strand rounded to a whole level, or where they started when
 * nothing is stored yet. Only levels: no name, birth year or answer. */
export async function studentLevels(
  db: Database,
  personId: string,
): Promise<ProfileLevels | null> {
  const learner = (
    await db.query<{
      id: string;
      birthYear: number | null;
      adult: boolean;
      band: StartingChoice | null;
    }>(
      `SELECT l.id,l.birth_year AS "birthYear",l.adult,l.starting_band AS band
       FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id AND l.deleted_at IS NULL
       WHERE p.id=$1 AND p.deleted_at IS NULL`,
      [personId],
    )
  ).rows[0];
  if (!learner) return null;
  const stored = (
    await db.query<{
      frontier: {
        overall: { level: number };
        strands: Record<string, { level: number }>;
      };
    }>(
      "SELECT frontier FROM amp_level_days WHERE learner_id=$1 ORDER BY day DESC LIMIT 1",
      [learner.id],
    )
  ).rows[0];
  if (stored)
    return roundedLevels(
      stored.frontier.overall.level,
      Object.fromEntries(
        Object.entries(stored.frontier.strands ?? {}).map(([strand, at]) => [
          strand,
          at.level,
        ]),
      ),
    );
  return roundedLevels(initialLevel(learner), {});
}
