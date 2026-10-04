/** DEV-ONLY spec-eval: an LLM judge with BINARY verdicts (binary beats 1–5 scales for agreement).
 * One call per batch so the judge can assess variety against the other items. */

export const JUDGE_SYSTEM = `You are a meticulous K–8 mathematics reviewer. An AI wrote a batch of practice activities for one learner; the app renders them from JSON and grades the answer key on the device. Audit each activity before a child sees it. Give BINARY verdicts: true only if you would ship it unchanged.

Rendering notes: "prompt" blocks are shown in order; a figure block draws the figure with that id; $...$ is TeX. Ordering items are listed in the correct order and the app shuffles them. multiple_choice options are shuffled unless shuffle:false. Coordinates in geometry are y-up units.

Criteria per activity:
correctKey — Solve it yourself from exactly what the learner sees (text, figure data, options). true iff the key is exactly right AND the question has one defensible answer AND every distractor / misconception answer is actually wrong AND figure data, text, hints and explanation all agree with the key. Any arithmetic slip, ambiguity, or figure that contradicts the text is false.
levelFit — true iff the activity practises the skill it claims, fits this learner now (frontier, due review, or a recurring misconception from LEARNER), uses numbers and language suited to the grade, and its difficulty is a sensible next step given suggestedDifficulty and recent results (harder after streaks, easier/more visual after errors).
varied — true iff it differs meaningfully from the other activities in this batch in context, representation or response type. If two are near-duplicates (same task with new numbers), mark the later one false.
figureHelps — null when the activity has no figure. Otherwise true iff the figure carries information the learner needs or genuinely uses (data to read, a model of the quantity, a diagram to measure), is consistent with the text, and does not give the answer away. Decorative, redundant or contradictory figures are false.
childAppropriate — true iff the wording is warm, clear and age-appropriate, the context is culturally neutral and kind (no brands, real people, violence, scary or personal topics), and nothing asks for personal information or actions outside the activity.

problems: "" when every verdict is true (or null); otherwise one short reason per false verdict.
gap: "" unless a clearly better activity for this learner needed something the format cannot express (a figure type, response type or field it lacks); then name it in one sentence.`;

export const JUDGE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['items', 'gap'],
  properties: {
    gap: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'correctKey', 'levelFit', 'varied', 'figureHelps', 'childAppropriate', 'problems'],
        properties: {
          id: { type: 'string' }, correctKey: { type: 'boolean' }, levelFit: { type: 'boolean' }, varied: { type: 'boolean' },
          figureHelps: { type: ['boolean', 'null'] }, childAppropriate: { type: 'boolean' }, problems: { type: 'string' },
        },
      },
    },
  },
};

export function judgeUser(state, batch) {
  const specs = batch.items.filter(i => i.ok).map(i => i.spec);
  return `LEARNER ${JSON.stringify(state.summary)}
AUTHOR RATIONALE ${JSON.stringify(batch.rationale)}
ACTIVITIES (${specs.length}):
${specs.map(s => JSON.stringify(s)).join('\n')}
Return one verdict object per activity, in the same order, with its id.`;
}

/** Attach verdicts to the batch's valid items; returns the batch-level gap note. */
export function applyVerdicts(batch, text) {
  let parsed;
  try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { return { error: 'judge reply was not JSON' }; }
  const valid = batch.items.filter(i => i.ok);
  const byId = new Map((parsed.items ?? []).map(v => [v.id, v]));
  valid.forEach((item, k) => {
    const v = byId.get(item.id) ?? parsed.items?.[k];
    if (!v) return;
    const hasFigure = (item.spec.figures ?? []).length > 0;
    item.judge = {
      correctKey: v.correctKey === true, levelFit: v.levelFit === true, varied: v.varied === true,
      figureHelps: hasFigure ? v.figureHelps === true : null, childAppropriate: v.childAppropriate === true,
      problems: typeof v.problems === 'string' ? v.problems.slice(0, 600) : '',
    };
  });
  return { gap: typeof parsed.gap === 'string' ? parsed.gap.slice(0, 400) : '' };
}
