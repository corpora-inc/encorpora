/** DEV-ONLY spec-eval: an LLM judge with BINARY verdicts (binary beats 1–5 scales for agreement).
 * One call per batch so the judge can assess variety against the other items. */

export const JUDGE_SYSTEM = `You are a meticulous K–8 mathematics reviewer. An AI wrote a batch of practice activities for one learner; the app renders them from JSON and grades the answer key on the device. Audit each activity before a child sees it. Give BINARY verdicts: true only if you would ship it unchanged.

Rendering notes: "prompt" blocks are shown in order; a figure block draws the figure with that id; $...$ is TeX. Ordering items are listed in the correct order and the app shuffles them. multiple_choice options are shuffled unless shuffle:false. Coordinates in geometry are y-up units.

Criteria per activity:
correctKey — Solve it yourself from exactly what the learner sees (text, figure data, options). true iff the key is exactly right AND the question has one defensible answer AND every distractor / misconception answer is actually wrong AND figure data, text, hints and explanation all agree with the key. Any arithmetic slip, ambiguity, or figure that contradicts the text is false.
levelFit — true iff the activity practises the skill it claims, fits this learner now (frontier, due review, or a recurring misconception from LEARNER), uses numbers and language suited to the grade, and its difficulty is a sensible next step given suggestedDifficulty and recent results (harder after streaks, easier/more visual after errors).
varied — true iff it differs meaningfully from the other activities in this batch in context, representation or response type. If two are near-duplicates (same task with new numbers), mark the later one false.
figureHelps — null when the activity has no figure. Otherwise true iff the figure carries information the learner needs or genuinely uses (data to read, a model of the quantity, a diagram to measure), is consistent with the text, and does not give the answer away. For K–2 counting, joining and taking-away tasks, a drawing the learner counts (crossed-out items included) IS the intended model, not a give-away; but alt text or a label that states the result is. Decorative, redundant or contradictory figures are false.
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

/** Attach verdicts to the items the judge was shown (by id only: a positional guess could pin one
 * activity's verdict on its neighbour); returns the batch-level gap note. */
export function applyVerdicts(shown, text) {
  let parsed;
  try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { return { error: 'judge reply was not JSON' }; }
  const byId = new Map((parsed.items ?? []).map(v => [v.id, v]));
  const missing = shown.filter(i => !byId.has(i.id)).map(i => i.id);
  if (missing.length) return { error: `judge gave no verdict for ${missing.join(', ')}` };
  shown.forEach(item => {
    const v = byId.get(item.id);
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

/**
 * The render judge (Activity Spec v2 README §12.3): it sees each activity as the learner does, a
 * phone screenshot of the focus stage, with the visible text, what a screen reader says for each
 * figure, and the key the app grades as correct. It never sees JSON, so v1 and v2 are judged alike.
 */
export const JUDGE_SYSTEM_RENDERED = `You are a meticulous K–8 mathematics reviewer. An AI wrote a batch of practice activities for one learner; the app rendered each one on a phone. You see every activity exactly as the learner will: one screenshot per activity (attached in order), its visible text, what a screen reader says for each figure, the answer controls, and the KEY the app will grade as correct. Give BINARY verdicts: true only if you would ship it unchanged.

Criteria per activity:
correctKey — Solve it yourself from exactly what the learner sees. true iff the KEY is exactly right AND the question has one defensible answer AND every option or distractor shown is wrong AND the figure, text, hints and explanation all agree with the key. Any arithmetic slip, ambiguity, unanswerable question (information missing from what is shown) or figure that contradicts the text is false.
levelFit — true iff the activity practises the skill it claims, fits this learner now (frontier, due review, or a recurring misconception from LEARNER), uses numbers and language suited to the grade, and is a sensible next step given suggestedDifficulty and recent results.
varied — true iff it differs meaningfully from the other activities in this batch in context, representation or answer form. If two are near-duplicates, mark the later one false.
figureHelps — null when the activity has no figure. Otherwise true iff the figure carries information the learner needs or genuinely uses, is consistent with the text, and does not give the answer away (on screen or in what the screen reader says). For K–2 counting tasks, a picture the learner counts IS the intended model.
childAppropriate — true iff the wording is warm, clear and age-appropriate, the context is culturally neutral and kind, and nothing asks for personal information.

problems: "" when every verdict is true (or null); otherwise one short reason per false verdict.
gap: "" unless a clearly better activity for this learner needed something the format cannot express; then name it in one sentence.`;

export function judgeUserRendered(state, batch, visibleOf) {
  const items = batch.items.filter(i => i.ok && i.shot);
  return `LEARNER ${JSON.stringify(state.summary)}
ACTIVITIES (${items.length}; screenshot k is activity k):
${items.map((i, k) => { const v = visibleOf(i.spec); return `${k + 1}. id ${i.id} · skills ${i.skillIds.join(', ')} · level ${i.difficulty}
  text: ${v.text.join(' / ')}
  figures (screen reader): ${v.figures.map(f => `${f.id}: ${f.alt}`).join(' | ') || 'none'}
  answer: ${v.answer}
  KEY: ${v.key}
  hints: ${v.hints.join(' / ') || 'none'}
  explanation: ${v.explanation}`; }).join('\n')}
Return one verdict object per activity, in the same order, with its id.`;
}
