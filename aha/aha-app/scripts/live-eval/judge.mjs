/** DEV-ONLY live-eval judge: a strong CLI model (`codex exec`, image attached) audits each RENDERED
 * activity: the focus-stage screenshot the learner sees, the learner-visible text, and the key the app
 * computed and will grade against. Binary checks (binary beats 1–5 scales for agreement). Replies are
 * cached by a hash of everything the judge sees, so re-scoring is free. Never calls Free2Z. */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CHECKS = ['keyCorrect', 'figureConsistent', 'answerable', 'wellPosed', 'levelFit', 'childAppropriate'];
export const CHECK_LABEL = { keyCorrect: 'key wrong', figureConsistent: 'figure ≠ text', answerable: 'not answerable from screen', wellPosed: 'ill-posed / leak', levelFit: 'off level / off skill', childAppropriate: 'not child-appropriate' };

export const JUDGE_RULES = `You audit one AI-written K–8 math practice activity exactly as a child sees it on a phone, before it ships. You get:
1. A SCREENSHOT of the activity in the app's focus stage (384x832 CSS px). This is the ground truth for what is drawn; data the app did not draw does not exist for the child.
2. The learner-visible TEXT (prompt, options, hints and explanation shown on request; figure alt text is read only by screen readers).
3. The KEY the app computed from the spec and will grade against (the child never sees it).
Solve the activity yourself from the screenshot and the visible text before judging. Answer each check true or false (figureConsistent is null when there is no figure). true means you would ship it unchanged.

keyCorrect: the computed KEY is exactly the right answer to the question as shown; every option marked correct is correct and every other option is wrong; misconception answers differ from the key.
figureConsistent: the figure AS DRAWN matches the text: the same objects, counts, groups, rows/columns, dimensions, shaded parts, labels and kind of shape or chart the text names ("3 groups" shows 3 groups; "rectangle" is a rectangle, not a pie; "shaded" parts are visibly shaded). Contradiction or a different representation than the text describes is false.
answerable: a child can answer using only what is on screen and in the text: every number they need is shown (side lengths labelled, unit squares drawn when asked to count square units, scale or key present), nothing needed is missing, cut off, overlapping or unreadable, and the response control matches what is asked (e.g. a number box for a count, tappable regions for "tap").
wellPosed: exactly one defensible answer; the question is unambiguous (which shape, which part, which unit); for tap/select items exactly the keyed regions fit; and the answer is not given away by a label, the figure, the text or an option.
levelFit: the activity practises its stated skill as titled, with numbers and language suited to the stated grade.
childAppropriate: warm, clear, age-appropriate wording; culturally neutral, kind context (no brands, real people, violence, scary or personal topics).

classes: the failing checks' names. problems: "" when all pass; otherwise one short, specific reason per failing check (what is wrong on screen).`;

export const JUDGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['keyCorrect', 'figureConsistent', 'answerable', 'wellPosed', 'levelFit', 'childAppropriate', 'problems'],
  properties: {
    keyCorrect: { type: 'boolean' }, figureConsistent: { type: ['boolean', 'null'] }, answerable: { type: 'boolean' },
    wellPosed: { type: 'boolean' }, levelFit: { type: 'boolean' }, childAppropriate: { type: 'boolean' }, problems: { type: 'string' },
  },
};

const figureLabel = (fig, id) => {
  const pick = fig.type === 'bar_chart' ? fig.bars.find(b => b.id === id)?.label
    : fig.type === 'pie_chart' ? fig.slices.find(s => s.id === id)?.label
    : fig.type === 'picture' ? (g => g && `${g.count} ${g.icon}${g.label ? ` "${g.label}"` : ''}`)(fig.groups.find(g => g.id === id))
    : fig.type === 'coordinate_plane' ? (p => p && `point (${p.x}, ${p.y})${p.label ? ` "${p.label}"` : ''}`)((fig.points ?? []).find(p => p.id === id))
    : fig.type === 'geometry' ? (s => s && `${s.kind}${s.label ? ` "${s.label}"` : ''}`)(fig.shapes.find(s => s.id === id)) : undefined;
  return pick ? `${id} (${pick})` : id;
};

/** What the child can read, in order, plus the key the app grades against. */
export function describeForJudge(spec, { evaluate } = {}) {
  const figs = new Map((spec.figures ?? []).map(f => [f.id, f]));
  const lines = [];
  if (spec.title) lines.push(`Title: ${spec.title}`);
  for (const b of spec.prompt) lines.push(b.type === 'text' ? b.text : b.type === 'math' ? `$${b.tex}$` : `[figure ${b.figureId}: ${figs.get(b.figureId)?.type ?? '?'}]`);
  const r = spec.response;
  let ask, key;
  switch (r.type) {
    case 'numeric': ask = `Type a number${r.label ? ` (label: ${r.label})` : ''}${r.unit ? ` (unit chip: ${r.unit})` : ''}`; key = `${r.answer}${r.tolerance ? ` ± ${r.tolerance}` : ''}`; break;
    case 'fraction': ask = `Type a fraction${r.mixed ? ' (mixed number allowed)' : ''}${r.form && r.form !== 'any' ? ` (form: ${r.form})` : ''}${r.label ? ` (label: ${r.label})` : ''}`; key = `${r.numerator}/${r.denominator}`; break;
    case 'expression': ask = `Type an expression in ${r.variables.join(', ')}${r.label ? ` (label: ${r.label})` : ''}`; key = r.answer; break;
    case 'multiple_choice': case 'multi_select':
      ask = `${r.type === 'multi_select' ? 'Select all that apply' : 'Choose one'}${r.shuffle === false ? '' : ' (options shuffled on screen)'}:\n${r.options.map(op => `  - ${op.text}`).join('\n')}`;
      key = r.options.filter(op => op.correct).map(op => op.text).join(' | '); break;
    case 'ordering': ask = `Put in order (shown shuffled)${r.firstLabel ? `, from "${r.firstLabel}"` : ''}${r.lastLabel ? ` to "${r.lastLabel}"` : ''}:\n${r.items.map(i => `  - ${i}`).join('\n')}`; key = r.items.join(' → '); break;
    case 'plot_point': ask = `Tap a point on figure ${r.figureId}`; key = `(${r.x}, ${r.y})${r.tolerance ? ` ± ${r.tolerance}` : ''}`; break;
    case 'tap_region': ask = `Tap a region of figure ${r.figureId}`; key = `region ${figs.has(r.figureId) ? figureLabel(figs.get(r.figureId), r.region) : r.region}`; break;
    // v2 act forms (ResolvedSpec).
    case 'shade': ask = `Tap parts of figure ${r.figureId} to shade them (${r.parts} parts)`; key = `any ${r.target} of the ${r.parts} parts shaded`; break;
    case 'place': ask = `Move a point on number line ${r.figureId} (ticks 0 to ${r.ticks})`; key = `tick ${r.target} of ${r.ticks}`; break;
    case 'tap_view': ask = `Tap one of the pictures: ${r.figureIds.map((id, i) => `Picture ${i + 1} = figure ${id}`).join(', ')}`; key = `figure ${r.figureId} (Picture ${r.figureIds.indexOf(r.figureId) + 1})`; break;
  }
  const misc = r.misconceptionAnswers?.length ? `\nMisconception answers (graded as specific wrong answers): ${r.misconceptionAnswers.map(m => 'answer' in m ? m.answer : `${m.numerator}/${m.denominator}`).join(', ')}` : '';
  let check = '';
  if (spec.keyCheck) {
    const k = spec.keyCheck;
    check = 'value' in k ? `\nAuthor's keyCheck arithmetic: ${k.value}${evaluate ? ` = ${evaluate(k.value)}` : ''}` : `\nAuthor's keyCheck point: (${k.x}, ${k.y})`;
  }
  const alts = (spec.figures ?? []).map(f => `  ${f.id} (${f.type}): ${f.alt}${f.caption ? ` | caption: ${f.caption}` : ''}`).join('\n');
  return `VISIBLE PROMPT:\n${lines.join('\n')}\n\nRESPONSE CONTROL:\n${ask}\n\nHINTS (on request): ${(spec.hints ?? []).join(' / ') || '-'}\nEXPLANATION (after answering): ${spec.explanation}\n${alts ? `\nFIGURE ALT TEXT (screen readers only):\n${alts}\n` : ''}\nKEY THE APP GRADES AGAINST: ${key}${misc}${check}`;
}

function runCodex(args, input, cwd, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn('codex', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, NO_COLOR: '1' } });
    let err = '';
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.stdout.on('data', () => {}); child.stderr.on('data', b => err += b);
    child.on('close', code => { clearTimeout(timer); resolve({ code, err }); });
    child.stdin.end(input);
  });
}

/** One verdict. `context` is the learner/skill line; `shotPath` the PNG. */
export async function judgeItem({ shotPath, text, context, model = 'gpt-6.1-sol', effort = 'medium', cacheDir, retries = 1, timeoutMs = 420_000 }) {
  const image = readFileSync(shotPath);
  const key = createHash('sha256').update(JSON.stringify({ v: 1, model, effort, rules: JUDGE_RULES, text, context })).update(image).digest('hex').slice(0, 24);
  const file = path.join(cacheDir, `${key}.json`);
  if (existsSync(file)) return { ...JSON.parse(readFileSync(file, 'utf8')), cached: true };
  mkdirSync(cacheDir, { recursive: true });
  for (let attempt = 0; ; attempt++) {
    const cwd = mkdtempSync(path.join(os.tmpdir(), 'live-eval-judge-'));
    try {
      writeFileSync(path.join(cwd, 'schema.json'), JSON.stringify(JUDGE_SCHEMA));
      writeFileSync(path.join(cwd, 'shot.png'), image);
      const out = path.join(cwd, 'last.txt');
      const args = ['exec', '--skip-git-repo-check', '--ephemeral', '-s', 'read-only', '--color', 'never', '-o', out, '-m', model,
        '-c', `model_reasoning_effort="${effort}"`, '--output-schema', path.join(cwd, 'schema.json'), '-i', path.join(cwd, 'shot.png'), '-'];
      const prompt = `Do not run commands or read files; everything you need is below and in the attached image.\n\n${JUDGE_RULES}\n\nCONTEXT: ${context}\n\n${text}\n\nReturn the JSON verdict.`;
      const res = await runCodex(args, prompt, cwd, timeoutMs);
      const raw = existsSync(out) ? readFileSync(out, 'utf8') : '';
      try {
        const v = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
        const verdict = Object.fromEntries([...CHECKS.map(c => [c, c === 'figureConsistent' ? (v[c] === null ? null : v[c] === true) : v[c] === true]), ['problems', String(v.problems ?? '').slice(0, 600)]]);
        writeFileSync(file, JSON.stringify(verdict));
        return verdict;
      } catch {
        if (attempt >= retries) return { error: `judge failed (codex exit ${res.code}): ${res.err.split('\n').filter(l => /error/i.test(l)).slice(-2).join(' | ').slice(0, 300)}` };
      }
    } finally { rmSync(cwd, { recursive: true, force: true }); }
  }
}

/** Good = every check passes (a null figure check counts as passing). */
export const isGood = v => !!v && !v.error && CHECKS.every(c => v[c] !== false);
export const failing = v => (!v || v.error) ? [] : CHECKS.filter(c => v[c] === false);
