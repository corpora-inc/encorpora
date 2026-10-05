import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { standards } from '../../../curriculum/standards';
import { fixtures } from './fixtures';
import { checkTex, renderTex } from './text';
import { extractJsonObject, FigureSchema, ResponseSchema, validateActivityBatch, validateActivitySpec, type ActivitySpec } from './spec';
import { activityBatchJsonSchema, activityBatchStrictJsonSchema, activitySpecJsonSchema } from './schema';

const skillIds = new Set(standards.map(s => s.id));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const base = (): ActivitySpec => clone(fixtures.find(f => f.id === 'fx-2-fruit-graph')!);
const rejects = (mutate: (s: any) => void, pattern: RegExp, options = { skillIds }) => {
  const spec: any = base();
  mutate(spec);
  const r = validateActivitySpec(spec, options);
  assert.equal(r.ok, false, `expected rejection matching ${pattern}`);
  if (!r.ok) assert.match(r.errors.join(' | '), pattern);
};

describe('Activity Spec v1 validator', () => {
  it('accepts every fixture and the fixtures cover all figure and response types', () => {
    for (const f of fixtures) {
      const r = validateActivitySpec(clone(f), { skillIds });
      assert.ok(r.ok, `${f.id}: ${r.ok ? '' : r.errors.join('; ')}`);
    }
    assert.ok(fixtures.length >= 30);
    assert.equal(new Set(fixtures.map(f => f.id)).size, fixtures.length);
    const figureTypes = new Set(fixtures.flatMap(f => (f.figures ?? []).map(x => x.type)));
    assert.deepEqual([...figureTypes].sort(), FigureSchema.options.map(o => o.shape.type.value).sort());
    assert.deepEqual([...new Set(fixtures.map(f => f.response.type))].sort(), ResponseSchema.options.map(o => o.shape.type.value).sort());
    const grades = new Set(fixtures.flatMap(f => f.skillIds.map(s => s.split('.')[0])));
    for (const g of ['K', '1', '2', '3', '4', '5', '6', '7', '8']) assert.ok(grades.has(g), `grade ${g} covered`);
  });
  it('rejects unknown fields anywhere', () => {
    rejects(s => { s.html = '<b>x</b>'; }, /unknown field\(s\) html/);
    rejects(s => { s.figures[0].onclick = 'alert(1)'; }, /unknown field|Invalid input/);
    rejects(s => { s.response.correctAnswer = 5; }, /unknown field|Invalid input/);
    rejects(s => { s.figures[0].bars[0].style = 'fill:red'; }, /unknown field\(s\) style/);
  });
  it('rejects HTML, links and control characters in text', () => {
    rejects(s => { s.prompt[0].text = 'Click <img src=x onerror=alert(1)> now'; }, /HTML or markup/);
    rejects(s => { s.prompt[0].text = '<script>alert(1)</script>'; }, /HTML or markup/);
    rejects(s => { s.explanation = 'See https://evil.example for help'; }, /links/);
    rejects(s => { s.explanation = 'Visit www.example.org'; }, /links/);
    rejects(s => { s.prompt[0].text = 'javascript:alert(1)'; }, /links/);
    rejects(s => { s.figures[0].alt = 'Bars ‮evil'; }, /control characters/);
    rejects(s => { s.figures[0].bars[0].label = '<b>Apples</b>'; }, /HTML or markup/);
    rejects(s => { s.prompt[0].text = 'Tom &amp; Ana'; }, /HTML or markup/);
  });
  it('rejects dangerous or invalid TeX', () => {
    rejects(s => { s.prompt[0].text = 'Click $\\href{javascript:alert(1)}{here}$'; }, /not allowed/);
    rejects(s => { s.prompt[0].text = '$\\url{https://x.test}$'; }, /not allowed/);
    rejects(s => { s.prompt[0].text = '$\\htmlClass{x}{y}$'; }, /not allowed/);
    rejects(s => { s.prompt[0].text = '$\\def\\x{\\x\\x}\\x$'; }, /not allowed/);
    rejects(s => { s.prompt[0].text = '$\\newcommand{\\a}{b}$'; }, /not allowed/);
    rejects(s => { s.prompt[0].text = '$\\frac{1}{$'; }, /typeset|Unbalanced/);
    rejects(s => { s.prompt[0].text = 'It costs $3 and $5 for two.'; }, /Words inside math/);
    rejects(s => { s.prompt[0].text = 'Price: $5'; }, /Unbalanced/);
    rejects(s => { s.prompt.push({ type: 'math', tex: '\\includegraphics{x.png}' }); }, /not allowed/);
    rejects(s => { s.prompt[0].text = '$x <script>$'; }, /markup/);
  });
  it('allows ordinary math notation including inequalities and currency', () => {
    const spec = base();
    spec.prompt[0] = { type: 'text', text: 'If $b<a$ and $x \\le 3$, a toy costs \\$4.50 and $\\frac{3}{4} \\times 2 = 1\\frac{1}{2}$, $\\sqrt{16}=4$, $30°$.' };
    const r = validateActivitySpec(spec, { skillIds });
    assert.ok(r.ok, r.ok ? '' : r.errors.join('; '));
  });
  it('bounds sizes: huge arrays, long strings, deep nesting, non-finite numbers', () => {
    rejects(s => { s.figures[0].bars = Array.from({ length: 13 }, (_, i) => ({ label: `B${i}`, value: i })); }, /Too big|at most|<=12/i);
    rejects(s => { s.figures[0].bars = Array.from({ length: 100000 }, (_, i) => ({ label: `B${i}`, value: i })); }, /too large|oversized/);
    rejects(s => { s.explanation = 'a'.repeat(1201); }, /Too big|1200/i);
    rejects(s => { s.prompt[0].text = 'x'.repeat(5000); }, /oversized|Too big/);
    rejects(s => { let o: any = {}; const root = o; for (let i = 0; i < 30; i++) { o.a = {}; o = o.a; } s.figures[0].extra = root; }, /nested too deeply|Unrecognized/);
    rejects(s => { s.figures[0].bars[0].value = Infinity; }, /expected number|Invalid/);
    rejects(s => { s.figures[0].bars[0].value = 1e9; }, /Too big|1000000/i);
    rejects(s => { s.difficulty = 11; }, /Too big|10/);
    rejects(s => { s.difficulty = 2.5; }, /int/i);
  });
  it('requires skill ids from the standards graph', () => {
    rejects(s => { s.skillIds = ['9.ZZ.A.1']; }, /Invalid string|pattern/);
    rejects(s => { s.skillIds = ['3.NF.D.9']; }, /unknown skill/);
    rejects(s => { s.skillIds = ['2.MD.D.10', '2.MD.D.10']; }, /duplicates/);
    rejects(() => {}, /unknown skill/, { skillIds: new Set(['3.NF.A.1']) });
  });
  it('checks AI answer keys against keyCheck arithmetic', () => {
    rejects(s => { s.response.answer = 6; }, /keyCheck: 9 - 4 = 5, but the answer key is 6/);
    rejects(s => { delete s.keyCheck; }, /keyCheck: required/);
    rejects(s => { s.keyCheck = { value: 'alert(1)' }; }, /keyCheck|Use only|variables/);
    rejects(s => { s.keyCheck = { value: '1/0' }; }, /undefined/);
    const frac: any = clone(fixtures.find(f => f.id === 'fx-4-add-eighths')!);
    frac.response.numerator = 6;
    assert.match(String((validateActivitySpec(frac, { skillIds }) as any).errors), /keyCheck/);
    const plot: any = clone(fixtures.find(f => f.id === 'fx-8-system-plot')!);
    plot.response.y = 4;
    assert.match(String((validateActivitySpec(plot, { skillIds }) as any).errors), /keyCheck/);
    const noKey: any = base(); delete noKey.keyCheck;
    assert.equal(validateActivitySpec(noKey, { skillIds, requireKeyCheck: false }).ok, true);
  });
  it('enforces cross-field rules', () => {
    rejects(s => { s.prompt = s.prompt.filter((b: any) => b.type !== 'figure'); }, /never shown/);
    rejects(s => { s.prompt.push({ type: 'figure', figureId: 'nope' }); }, /does not exist/);
    rejects(s => { s.prompt = [{ type: 'figure', figureId: 'votes' }]; }, /at least one text block/);
    rejects(s => { s.figures[0].yMax = 5; }, /yMax/);
    const mc: any = clone(fixtures.find(f => f.id === 'fx-1-half-hour')!);
    mc.response.options[1].correct = true;
    assert.match(String((validateActivitySpec(mc, { skillIds }) as any).errors), /exactly one option/);
    const tap: any = clone(fixtures.find(f => f.id === 'fx-k-which-more')!);
    tap.response.region = 'cats';
    assert.match(String((validateActivitySpec(tap, { skillIds }) as any).errors), /not in the figure/);
    const plot: any = clone(fixtures.find(f => f.id === 'fx-5-plant-the-tree')!);
    plot.figures[0].points.push({ x: 6, y: 4 });
    assert.match(String((validateActivitySpec(plot, { skillIds }) as any).errors), /already shows the answer/);
    const fn: any = clone(fixtures.find(f => f.id === 'fx-8-slope')!);
    fn.figures[0].functions[0].expr = 'constructor.constructor("alert(1)")()';
    assert.match(String((validateActivitySpec(fn, { skillIds }) as any).errors), /functions\[0\]/);
    const expr: any = clone(fixtures.find(f => f.id === 'fx-6-write-expression')!);
    expr.response.answer = '3m+2';
    assert.match(String((validateActivitySpec(expr, { skillIds }) as any).errors), /Use only n/);
  });
  it('requires plot answers to be reachable on the per-axis snap grid', () => {
    const plot = (): any => clone(fixtures.find(f => f.id === 'fx-5-plant-the-tree')!);
    const half = plot(); half.response.x = 2.5; half.keyCheck = { x: '5/2', y: '4' };
    assert.match(String((validateActivitySpec(half, { skillIds }) as any).errors), /not reachable on the plotting grid/);
    half.response.snap = 0.5;
    assert.equal(validateActivitySpec(half, { skillIds }).ok, true, 'explicit snap makes it reachable');
    const tolerant = plot(); tolerant.response.x = 2.5; tolerant.response.tolerance = 0.5; tolerant.keyCheck = { x: '5/2', y: '4' };
    assert.equal(validateActivitySpec(tolerant, { skillIds }).ok, true, 'tolerance covers the nearest grid point');
    const axes = plot(); axes.figures[0].x = { min: 0, max: 100, step: 10 }; axes.figures[0].points[0].x = 20;
    axes.response.x = 20; axes.response.y = 3; axes.keyCheck = { x: '20', y: '3' };
    assert.equal(validateActivitySpec(axes, { skillIds }).ok, true, 'y snaps to its own step, not x');
    axes.response.x = 25; axes.keyCheck = { x: '25', y: '3' };
    assert.match(String((validateActivitySpec(axes, { skillIds }) as any).errors), /not reachable/);
  });
  it('accepts harmless ampersands and comparisons in plain text', () => {
    for (const text of ['Q&A time: rock & roll', 'Is 7 < 9?', 'Use the data: 3, 5, 7']) {
      const spec: any = base(); spec.prompt[0].text = text;
      const r = validateActivitySpec(spec, { skillIds });
      assert.ok(r.ok, `${text}: ${r.ok ? '' : r.errors.join('; ')}`);
    }
  });
  it('treats null members as absent (strict-mode output)', () => {
    const spec: any = base();
    spec.title = null; spec.misconceptions = null; spec.figures[0].orientation = null;
    assert.equal(validateActivitySpec(spec, { skillIds }).ok, true);
    const bad: any = base(); bad.prompt = [null];
    assert.equal(validateActivitySpec(bad, { skillIds }).ok, false);
  });
});

describe('batch parsing and validation', () => {
  const two = () => ({ rationale: 'Practice reading graphs, then a counting warm-up.', activities: [base(), clone(fixtures[0]!)] });
  it('extracts the outermost object from fenced or chatty replies', () => {
    const text = 'Sure! Here you go:\n```json\n' + JSON.stringify(two()) + '\n```\nEnjoy {not json}';
    const r = validateActivityBatch(text, { skillIds });
    assert.equal(r.accepted.length, 2);
    assert.deepEqual(r.errors, []);
    const chatty = validateActivityBatch('Sure {here} is the batch: ' + JSON.stringify(two()), { skillIds });
    assert.equal(chatty.accepted.length, 2, 'skips a stray brace before the payload');
    const braces = extractJsonObject('{"a":"} { \\" }","b":{"c":1}} trailing }');
    assert.ok(braces.ok && (braces.value as any).b.c === 1);
  });
  it('drops invalid activities per item without discarding the batch', () => {
    const batch: any = two();
    batch.activities[0].response.answer = 99;
    batch.activities.push({ version: 1, id: 'junk' });
    const r = validateActivityBatch(batch, { skillIds });
    assert.equal(r.accepted.length, 1);
    assert.equal(r.rejected.length, 2);
    assert.deepEqual(r.rejected.map(x => x.index), [0, 2]);
  });
  it('salvages complete activities from a truncated reply', () => {
    const full = JSON.stringify({ rationale: 'Mixed review.', activities: [base(), clone(fixtures[0]!), clone(fixtures[5]!)] });
    const cut = full.slice(0, full.length - 200);
    const r = validateActivityBatch(cut, { skillIds });
    assert.equal(r.accepted.length, 2);
    assert.equal(r.rationale, 'Mixed review.');
    assert.match(r.errors.join(' '), /truncated; kept 2/);
  });
  it('keeps the other activities when one has a JSON slip', () => {
    const acts = [base(), clone(fixtures[0]!), clone(fixtures[5]!)].map(a => JSON.stringify(a));
    // spec-eval saw this from a model: a missing } after one activity's response.
    const missingBrace = acts[1]!.replace(/\},"keyCheck"/, ',"keyCheck"');
    const missingQuote = acts[1]!.replace('"hints":', '"hints:');
    for (const broken of [missingBrace, missingQuote]) {
      assert.notEqual(broken, acts[1]);
      const text = `{"rationale":"Mixed review.","activities":[${acts[0]},${broken},${acts[2]}]}`;
      assert.throws(() => JSON.parse(text));
      const r = validateActivityBatch(text, { skillIds });
      assert.deepEqual(r.accepted.map(a => a.id), [JSON.parse(acts[0]!).id, JSON.parse(acts[2]!).id]);
      assert.deepEqual(r.rejected.map(x => [x.index, x.errors[0]]), [[1, 'Activity JSON is malformed.']]);
      assert.equal(r.rationale, 'Mixed review.');
      assert.match(r.errors.join(' '), /malformed; kept 2/);
    }
    // An extra closing brace must not let an inner activity pass as the envelope.
    const extra = `{"rationale":"x","activities":[${acts[0]}},${acts[2]}]}`;
    const e = validateActivityBatch(extra, { skillIds });
    assert.deepEqual(e.accepted.map(a => a.id), [JSON.parse(acts[0]!).id, JSON.parse(acts[2]!).id]);
    // Valid JSON of the wrong shape stays strict; recovery never widens the envelope rules.
    assert.equal(validateActivityBatch(`{"batch":{"rationale":"r","activities":[${acts[0]},${acts[2]}]}}`, { skillIds }).accepted.length, 0);
    const six = Array.from({ length: 6 }, (_, i) => acts[0]!.replace('"fx-2-fruit-graph"', `"a-${i}"`)).join(',');
    assert.equal(validateActivityBatch(`{"rationale":"r","activities":[${six},]}`, { skillIds }).accepted.length, 0, 'more than 5 is rejected even when damaged');
    assert.equal(validateActivityBatch(`{"rationale":5,"activities":[${acts[0]},${missingBrace}]}`, { skillIds }).accepted.length, 0, 'a damaged reply still needs a real rationale');
    // An activity whose "version" key is not first is reported, not silently dropped: it is located
    // as an array element (key order never decides; zuu#1132) and rejected for its own errors.
    const reordered = JSON.stringify({ id: 'a-late', version: 1 });
    const lost = validateActivityBatch(`{"rationale":"r","activities":[${acts[0]},${reordered.replace('}', ',"skillIds":["2.MD.D.10"]}')},${missingBrace}]}`, { skillIds });
    assert.equal(lost.accepted.length, 1);
    assert.ok(lost.rejected.some(r => r.id === 'a-late'), JSON.stringify(lost.rejected));
    // A reply with no recoverable activity still fails as a whole.
    assert.match(validateActivityBatch('{"rationale":"x","activities":[{"version":1,"id":"a" ', { skillIds }).errors[0]!, /incomplete/);
  });
  it('accepts a blank answer box and column arithmetic in math, nothing broader', () => {
    for (const ok of ['4=\\square+1', '3+\\boxed{\\phantom{0}}=5', '\\boxed{\\phantom{00}}-7=12', '\\begin{array}{r}245\\\\+\;37\\\\\\hline\\end{array}']) {
      assert.equal(checkTex(ok), null, ok);
      assert.doesNotMatch(renderTex(ok), /\?/, ok);
    }
    for (const bad of ['\\phantom{0}+2', '\\boxed{\\phantom{secret}}', '\\boxed{\\phantom{2}}', '\\\\boxed{\\phantom{0}}', '\\boxed{\\phantom{0}\\phantom{0}}', '\\fbox{\\phantom{0}}', '\\begin{array}{r}costs\\end{array}', '\\begin{array}{r}1\\end{array}{rcl}']) assert.notEqual(checkTex(bad), null, bad);
  });
  it('rejects malformed envelopes and duplicate ids', () => {
    assert.match(validateActivityBatch('no json here', { skillIds }).errors[0]!, /no JSON object/);
    assert.match(validateActivityBatch({ activities: [] , rationale: 'x' }, { skillIds }).errors[0]!, /1–5/);
    assert.match(validateActivityBatch({ ...two(), extra: 1 }, { skillIds }).errors[0]!, /Unknown field/);
    const dup = { rationale: 'x', activities: [base(), base()] };
    const r = validateActivityBatch(dup, { skillIds });
    assert.equal(r.accepted.length, 1);
    assert.match(r.rejected[0]!.errors[0]!, /Duplicate/);
  });
});

describe('exported JSON Schemas', () => {
  type Node = Record<string, unknown>;
  const walk = (n: unknown, visit: (o: Node) => void) => {
    if (Array.isArray(n)) n.forEach(x => walk(x, visit));
    else if (n && typeof n === 'object') { visit(n as Node); Object.values(n).forEach(x => walk(x, visit)); }
  };
  it('standard schemas are strict objects with bounds', () => {
    walk(activitySpecJsonSchema, o => { if (o.type === 'object' && o.properties) assert.equal(o.additionalProperties, false); });
    const text = JSON.stringify(activityBatchJsonSchema);
    assert.ok(text.includes('"maxItems":5') && text.includes('"maxLength":1200'));
    assert.ok(!text.includes('oneOf'));
  });
  it('strict variant is OpenAI strict-mode compatible', () => {
    const s = activityBatchStrictJsonSchema;
    assert.equal(s.type, 'object');
    assert.ok(!('anyOf' in s) && !('oneOf' in s));
    walk(s, o => {
      for (const banned of ['oneOf', 'minLength', 'maxLength', 'const', '$schema']) assert.ok(!(banned in o), `no ${banned}`);
      if (o.properties) {
        assert.equal(o.additionalProperties, false);
        assert.deepEqual([...(o.required as string[])].sort(), Object.keys(o.properties as object).sort());
      }
    });
    const title = ((s.properties as any).activities.items.properties.title);
    assert.deepEqual(title.type, ['string', 'null']);
  });
});
