/**
 * Binding the declared model (README §3, §5): quantities parsed and valued exactly, structure roles
 * bound to typed quantities, measures computed by the registry, and every reference resolved.
 *
 * Values are computed lazily, so a derived quantity may use a measure ("s.total - e") and a role may
 * bind a derived quantity ("size = t/g"); a cycle between them is reported, never looped.
 */
import { parseExpr, quantityValue, type Described, type Expr, type Issue, type QuantityDecl, type Result, type Value } from './quantity';
import { nounFormIssues } from './text';
import type { BoundRole, MeasureDef, Roles, StructureDef } from './registry';
import { inRange, isIssue, rangeLabel } from './registry';
import { structureDef, type StructureKind } from './structures';
import { RESERVED_IDS, type WireActivity, type WireStructure } from './wire';

export interface Problem { layer: 'L0' | 'L1' | 'L2'; code: string; path: string; message: string }
export const problem = (layer: Problem['layer'], path: string, i: Issue): Problem => ({ layer, path, code: i.code, message: i.message });

export interface BoundQuantity { decl: QuantityDecl; expr: Expr; value: Value; derived: boolean }
export interface BoundStructure { wire: WireStructure; def: StructureDef; roles: Roles<string>; index: number }
/**
 * What a reference names. `key` is canonical: a quantity's id (a role reference resolves to the
 * quantity it binds) or `structure.measure`.
 */
export type Target =
  | { kind: 'quantity'; key: string; id: string; via?: { structure: string; role: string } }
  | { kind: 'measure'; key: string; structure: string; measure: string };

export interface Model {
  quantities: ReadonlyMap<string, BoundQuantity>;
  structures: ReadonlyMap<string, BoundStructure>;
  /** For each quantity id, the structure roles that bind it. */
  bindings: ReadonlyMap<string, { structure: string; role: string }[]>;
  /** Resolve a reference path to its target (no value). */
  target(path: readonly string[]): Result<Target>;
  /** The value of a reference path (expressions). */
  resolve(path: readonly string[]): Result<Value>;
  /** The value with its noun and kind (placeholders). */
  describe(t: Target): Described;
  /** The quantity behind a target, when it is one, and its own references. */
}

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (code: string, message: string): { ok: false; error: Issue } => ({ ok: false, error: { code, message } });

/**
 * Bind a validated wire model. Problems are L1 and carry wire paths. A model with problems is not
 * returned: everything after binding may assume every reference resolves and every value exists.
 */
export function bindModel(m: WireActivity['model'], grade: number): { ok: true; model: Model } | { ok: false; problems: Problem[] } {
  const problems: Problem[] = [];
  const p = (path: string, code: string, message: string) => problems.push({ layer: 'L1', path, code, message });

  // Ids: one namespace for quantities and structures, never a name the grammar reserves.
  const seen = new Map<string, string>();
  const claim = (id: string, path: string) => {
    if (RESERVED_IDS.has(id)) p(path, 'id_reserved', `"${id}" is reserved; choose another id.`);
    else if (seen.has(id)) p(path, 'id_duplicate', `"${id}" is already the id of ${seen.get(id)}.`);
    else seen.set(id, path);
  };
  m.quantities.forEach((q, i) => claim(q.id, `model.quantities[${i}].id`));
  m.structures.forEach((s, i) => claim(s.id, `model.structures[${i}].id`));

  // Quantities: parse values and check noun forms.
  const exprs = new Map<string, { decl: QuantityDecl; expr: Expr; index: number }>();
  m.quantities.forEach((q, i) => {
    const path = `model.quantities[${i}]`;
    const e = parseExpr(q.value);
    if (!e.ok) p(`${path}.value`, e.error.code, e.error.message);
    else exprs.set(q.id, { decl: q, expr: e.value, index: i });
    if (q.noun) for (const form of ['one', 'other'] as const) for (const issue of nounFormIssues(q.noun[form])) p(`${path}.noun.${form}`, issue.code, issue.message);
  });

  // Structures: definitions, grades, roles bound to quantities of the right kind.
  const structures = new Map<string, BoundStructure>();
  const roleIds = new Map<string, Record<string, string | null>>();
  const bindings = new Map<string, { structure: string; role: string }[]>();
  m.structures.forEach((s, i) => {
    const path = `model.structures[${i}]`;
    const def = structureDef(s.kind as StructureKind);
    if (!inRange(grade, def.grades)) p(`${path}.kind`, 'off_grade', `${s.kind} is for grades ${rangeLabel(def.grades)}, not grade ${grade === 0 ? 'K' : grade}.`);
    if (s.show !== null) {
      const view = def.views[s.show as string];
      if (view && !inRange(grade, view.grades)) p(`${path}.show`, 'off_grade', `The ${s.show} view of ${s.kind} is for grades ${rangeLabel(view.grades)}.`);
    }
    const ids: Record<string, string | null> = {};
    for (const [role, spec] of Object.entries(def.roles)) {
      const qid = (s.roles as Record<string, string | null>)[role] ?? null;
      ids[role] = qid;
      if (qid === null) { if (!spec.nullable) p(`${path}.roles.${role}`, 'role_missing', `${s.kind} needs ${role}.`); continue; }
      const q = m.quantities.find(x => x.id === qid);
      if (!q) { p(`${path}.roles.${role}`, 'ref_unknown', `${role} names "${qid}", which is not a quantity.`); continue; }
      if (!spec.kinds.includes(q.kind)) p(`${path}.roles.${role}`, 'role_kind', `${role} must be a ${spec.kinds.join(' or ')}, but ${qid} is a ${q.kind}.`);
      (bindings.get(qid) ?? bindings.set(qid, []).get(qid)!).push({ structure: s.id, role });
    }
    roleIds.set(s.id, ids);
    structures.set(s.id, { wire: s, def, roles: {}, index: i });
  });
  if (problems.length) return { ok: false, problems };

  // Lazy exact values, with cycle detection.
  const values = new Map<string, Value>();
  const measureValues = new Map<string, Value>();
  const visiting = new Set<string>();
  const valueOf = (id: string): Result<Value> => {
    const done = values.get(id);
    if (done) return ok(done);
    const q = exprs.get(id)!;
    if (visiting.has(id)) return fail('ref_cycle', `${id} depends on itself.`);
    visiting.add(id);
    const v = quantityValue(q.decl, q.expr, resolve);
    visiting.delete(id);
    if (v.ok) values.set(id, v.value);
    return v;
  };
  const rolesOf = (sid: string): Result<Roles<string>> => {
    const out: Record<string, BoundRole | null> = {};
    for (const [role, qid] of Object.entries(roleIds.get(sid)!)) {
      if (qid === null) { out[role] = null; continue; }
      const v = valueOf(qid);
      if (!v.ok) return v;
      out[role] = { id: qid, decl: exprs.get(qid)!.decl, value: v.value };
    }
    return ok(out);
  };
  const measureOf = (sid: string, name: string, def: MeasureDef<string>): Result<Value> => {
    const key = `${sid}.${name}`;
    const done = measureValues.get(key);
    if (done) return ok(done);
    if (visiting.has(key)) return fail('ref_cycle', `${key} depends on itself.`);
    visiting.add(key);
    const r = rolesOf(sid);
    visiting.delete(key);
    if (!r.ok) return r;
    const missing = def.inputs.filter(i => !r.value[i]);
    if (missing.length) return fail('measure_unavailable', `${key} needs ${missing.join(' and ')}, which ${missing.length > 1 ? 'are' : 'is'} null.`);
    const v = def.value(r.value);
    if (isIssue(v)) return { ok: false, error: v };
    measureValues.set(key, v);
    return ok(v);
  };
  const target = (path: readonly string[]): Result<Target> => {
    const [head, member, extra] = path;
    if (!head) return fail('ref_unknown', 'An empty reference.');
    if (exprs.has(head)) {
      return member === undefined ? ok({ kind: 'quantity', key: head, id: head }) : fail('ref_member', `${head} is a quantity; it has no member "${member}".`);
    }
    const s = structures.get(head);
    if (!s) return fail('ref_unknown', `"${head}" is not a quantity or structure id.`);
    if (member === undefined) return fail('ref_structure', `${head} is a structure; name a role or measure, e.g. ${head}.${s.def.primary}.`);
    if (extra !== undefined) return fail('ref_member', `${path.join('.')} goes too deep.`);
    if (Object.hasOwn(s.def.roles, member)) {
      const qid = roleIds.get(head)![member] ?? null;
      return qid === null ? fail('role_null', `${head}.${member} is null.`) : ok({ kind: 'quantity', key: qid, id: qid, via: { structure: head, role: member } });
    }
    if (Object.hasOwn(s.def.measures, member)) return ok({ kind: 'measure', key: `${head}.${member}`, structure: head, measure: member });
    return fail('ref_member', `${s.wire.kind} has no role or measure "${member}" (roles: ${Object.keys(s.def.roles).join(', ')}; measures: ${Object.keys(s.def.measures).join(', ')}).`);
  };
  const valueOfTarget = (t: Target): Result<Value> => {
    if (t.kind === 'quantity') return valueOf(t.id);
    const s = structures.get(t.structure)!;
    return measureOf(t.structure, t.measure, s.def.measures[t.measure]!);
  };
  function resolve(path: readonly string[]): Result<Value> {
    const t = target(path);
    return t.ok ? valueOfTarget(t.value) : t;
  }

  for (const [id, q] of exprs) {
    const v = valueOf(id);
    if (!v.ok) p(`model.quantities[${q.index}].value`, v.error.code, v.error.message);
  }
  if (problems.length) return { ok: false, problems };

  // Roles are valued now; the structures' own rules and their views' limits.
  for (const [sid, s] of structures) {
    s.roles = (rolesOf(sid) as { ok: true; value: Roles<string> }).value;
    const path = `model.structures[${s.index}]`;
    for (const i of s.def.invariants(s.roles, grade)) p(path, i.code, i.message);
    const view = s.wire.show === null ? null : s.def.views[s.wire.show as string];
    for (const i of view?.fits?.(s.roles, grade) ?? []) p(`${path}.show`, i.code, i.message);
  }
  if (problems.length) return { ok: false, problems };

  const quantities = new Map([...exprs].map(([id, q]) => [id, { decl: q.decl, expr: q.expr, value: values.get(id)!, derived: q.expr.t !== 'num' }]));
  const describe = (t: Target): Described => {
    const value = (valueOfTarget(t) as { ok: true; value: Value }).value;
    if (t.kind === 'quantity') { const d = quantities.get(t.id)!.decl; return { value, noun: d.noun, kind: d.kind }; }
    const s = structures.get(t.structure)!, def = s.def.measures[t.measure]!;
    return { value, noun: def.noun(s.roles), kind: def.kind };
  };
  return { ok: true, model: { quantities, structures, bindings, target, resolve, describe } };
}
