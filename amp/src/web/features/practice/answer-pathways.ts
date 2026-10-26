export type AnswerSkill = {
  id: string;
  title?: string;
  description?: string;
  prerequisites?: readonly string[];
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

/** Only authored, direct graph connections with a playable problem are offered. */
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
  const playable = (candidates: readonly AnswerSkill[]) =>
    candidates.flatMap((s) => {
      const templateId = available.get(s.id);
      return templateId && s.id !== skillId && s.title
        ? [{ ...s, title: s.title, templateId }]
        : [];
    });
  return {
    skill,
    buildsOn: playable(
      skills.filter((s) => skill?.prerequisites?.includes(s.id)),
    ),
    leadsTo: playable(skills.filter((s) => s.prerequisites?.includes(skillId))),
  };
}
