/**
 * The look a browser check's learner practices in, said outright.
 *
 * Nobody having chosen, a learner's look follows their grade
 * (src/learning/look.ts `startingLook`): Colorful through grade 5, Calm
 * after. A check whose learner is "born 2016" would then run in whichever
 * look that year happens to give, and change looks on a birthday. So a
 * check that measures layout or input sets its learner's look itself and
 * runs once per look:
 *
 * - Colorful once: it is one scheme (ui/tokens.css), the same under a
 *   device's light and dark, so a second pass would measure the same page;
 * - Calm in light and in dark, as these checks always ran.
 *
 * `AMP_UI_LOOKS` (`calm`, `bold` or `calm,bold`) narrows a run to one look,
 * for a lane that splits them or a local run of one.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Page } from "playwright";
import { lookSchema, type Look } from "../../src/learning/look";
import { changePractice } from "../../src/server/practice-settings";
import type { PostgresRepository } from "../../src/server/repository";

export type Theme = "light" | "dark";
export type LookTheme = {
  look: Look;
  theme: Theme;
  /** For tags and screenshot names: `light`, `dark` or `colorful`. */
  name: "light" | "dark" | "colorful";
};

/** The looks this run covers: both, unless `AMP_UI_LOOKS` names fewer. */
export function checkLooks(
  env: Record<string, string | undefined> = process.env,
): Look[] {
  const raw = env.AMP_UI_LOOKS;
  if (raw === undefined || raw === "") return ["calm", "bold"];
  const looks = raw.split(",").map((value) => lookSchema.parse(value.trim()));
  assert.equal(new Set(looks).size, looks.length, "AMP_UI_LOOKS repeats one");
  return looks;
}

/** One look for a check that runs its journey once (`AMP_UI_LOOK`). */
export function checkLook(
  fallback: Look,
  env: Record<string, string | undefined> = process.env,
): Look {
  const raw = env.AMP_UI_LOOK;
  return raw === undefined || raw === "" ? fallback : lookSchema.parse(raw);
}

/** Every pass of a layout or input check: Colorful, then Calm in light and
 * in dark. Colorful goes first so the learner is left in Calm: whatever a
 * check does after its passes then runs as it always has. */
export function lookThemes(
  themes: readonly Theme[] = ["light", "dark"],
  env: Record<string, string | undefined> = process.env,
): LookTheme[] {
  const looks = checkLooks(env);
  return [
    ...(looks.includes("bold")
      ? [
          {
            look: "bold" as const,
            theme: "light" as const,
            name: "colorful" as const,
          },
        ]
      : []),
    ...(looks.includes("calm")
      ? themes.map((theme) => ({ look: "calm" as const, theme, name: theme }))
      : []),
  ];
}

/** The learner's own choice of look, made as a grown-up of theirs would
 * make it: it comes before their grade's start, and stays. */
export async function wearLook(
  repository: PostgresRepository,
  account: string,
  learnerId: string,
  look: Look,
) {
  await repository.transaction(account, learnerId, async (tx) => {
    const settings = await tx.practiceSettings();
    if (settings.look === look) return;
    await changePractice(tx, {
      kind: "look",
      look,
      revision: settings.revision,
      requestId: randomUUID(),
    });
  });
}

/** The look `<html>` paints now. */
export const lookOnScreen = (page: Page): Promise<Look> =>
  page.evaluate(() =>
    document.documentElement.getAttribute("data-look") === "bold"
      ? "bold"
      : "calm",
  );

/** Practice is on screen in the look the check meant: a check that says it
 * covered Colorful did, and one that says Calm never ran dressed. The look
 * comes with the learner's practice state, so it is waited for (a device
 * that last showed the other look wears that one until the answer). */
export async function assertLookOnScreen(page: Page, look: Look, tag = "") {
  await page
    .waitForFunction(
      (bold) =>
        (document.documentElement.getAttribute("data-look") === "bold") ===
        bold,
      look === "bold",
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  assert.equal(
    await lookOnScreen(page),
    look,
    `${tag ? `${tag}: ` : ""}practice shows ${look === "bold" ? "Colorful" : "Calm"}`,
  );
}
