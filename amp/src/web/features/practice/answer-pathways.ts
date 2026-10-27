import { skillNeighbors, type NeighborConnection } from "../pathways/neighbors";
import { connectionLabel } from "../pathways/model";

export type AnswerSkill = {
  id: string;
  title?: string;
  description?: string;
  gradeBand?: string;
  prerequisites?: readonly string[];
  connections?: readonly NeighborConnection[];
};

/** Strict prerequisites are never crowded out; connections add a few more. */
export const answerConnectionLimit = 3;

type Choice = AnswerSkill & {
  title: string;
  templateId: string;
  connected?: { label: string; explanation: string };
};

/** Minimum further independent successes needed by the existing strength rule.
 * This is a conditional next step, never a percentage or a mastery estimate. */
export function answersToStrength(
  recent: readonly { correct: boolean; assisted: boolean }[],
) {
  let window = recent.slice(-5);
  for (let more = 0; more <= 5; more++) {
    if (
      window.length === 5 &&
      window.filter((a) => a.correct && !a.assisted).length >= 4 &&
      window.at(-1)?.correct &&
      !window.at(-1)?.assisted
    )
      return more;
    window = [...window, { correct: true, assisted: false }].slice(-5);
  }
  return 5;
}

/** Playable direct prerequisites first, then the nearest authored extension or
 * application connections, so a correct answer never ends at a dead end. */
export function answerPathways(
  skillId: string,
  skills: readonly AnswerSkill[],
  templates: readonly { id: string; skillId: string }[],
) {
  const skill = skills.find((s) => s.id === skillId);
  const available = new Map<string, string>();
  for (const template of templates) {
    if (!available.has(template.skillId))
      available.set(template.skillId, template.id);
  }
  const neighbors = skillNeighbors(skills, skillId);
  const playable = (items: typeof neighbors.buildsOn) => {
    let connected = 0;
    return items.flatMap(({ skill: s, source, connection }): Choice[] => {
      const templateId = available.get(s.id);
      if (!templateId || s.id === skillId || !s.title) return [];
      if (source === "prerequisite")
        return [{ ...s, title: s.title, templateId }];
      if (++connected > answerConnectionLimit) return [];
      return [
        {
          ...s,
          title: s.title,
          templateId,
          connected: {
            label: connection ? connectionLabel(connection) : "",
            explanation: connection?.explanation ?? "",
          },
        },
      ];
    });
  };
  return {
    skill,
    buildsOn: playable(neighbors.buildsOn.filter((n) => n.source !== "shared")),
    leadsTo: playable(neighbors.leadsTo.filter((n) => n.source !== "shared")),
  };
}
