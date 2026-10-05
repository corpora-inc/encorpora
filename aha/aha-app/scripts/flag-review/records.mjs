/** DEV-ONLY (npm run flag-review): read flagged activities out of a COPY of the app's SQLite DB.
 * Record shapes (src/storage.ts): a `records` row holds JSON `data`;
 *   kind='dispute'  → DisputeRecord  { id, activityId, createdAt, reason }  ("Something seems off")
 *   kind='activity' → ActivityRecord { id, sessionId, createdAt, data } where an AI activity's `data` is
 *     { id, source: 'ai-spec', operationId, model?, spec } (Controller.showSpec; `model` since #905) and a
 *     local task's `data` is the task itself (source: 'local', skillId, prompt, …). */

const parse = text => { try { return JSON.parse(text); } catch { return undefined; } };

/** CLI flags: --serial <id>, --since <iso>, --all-ai. ANDROID_SERIAL is the serial fallback. */
export function parseArgs(argv, env = {}) {
  const opts = { serial: env.ANDROID_SERIAL || undefined, since: undefined, allAi: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => { const v = argv[++i]; if (!v || v.startsWith('--')) throw new Error(`${a} needs a value`); return v; };
    if (a === '--serial') opts.serial = value();
    else if (a === '--since') {
      const v = value();
      if (Number.isNaN(Date.parse(v))) throw new Error(`--since needs an ISO date or time, got "${v}"`);
      opts.since = new Date(v).toISOString();
    } else if (a === '--all-ai') opts.allAi = true;
    else throw new Error(`Unknown argument "${a}". Usage: npm run flag-review -- [--serial <id>] [--since <iso>] [--all-ai]`);
  }
  return opts;
}

/**
 * Every dispute joined to the activity it set aside (or, with allAi, every AI activity, flagged or not),
 * oldest first. `db` is a node:sqlite DatabaseSync (opened read-only).
 */
export function collectEntries(db, { since, allAi = false } = {}) {
  const key = (account, profile, id) => `${account}\u0000${profile}\u0000${id}`;
  const activities = new Map();
  for (const row of db.prepare("SELECT account, profile, id, data FROM records WHERE kind='activity' ORDER BY rowid").all())
    activities.set(key(row.account, row.profile, row.id), { profile: row.profile, record: parse(row.data) });
  const entries = [];
  const flaggedKeys = new Set();
  for (const row of db.prepare("SELECT account, profile, data FROM records WHERE kind='dispute' ORDER BY rowid").all()) {
    const dispute = parse(row.data) ?? {};
    const k = key(row.account, row.profile, dispute.activityId);
    flaggedKeys.add(k);
    entries.push(entryFor(row.profile, dispute.activityId, activities.get(k)?.record, dispute));
  }
  if (allAi) for (const [k, { profile, record }] of activities)
    if (!flaggedKeys.has(k) && record?.data?.source === 'ai-spec') entries.push(entryFor(profile, record.id, record));
  const time = e => e.flaggedAt ?? e.activityCreatedAt ?? '';
  return entries.filter(e => !since || time(e) >= since).sort((a, b) => time(a).localeCompare(time(b)));
}

function entryFor(profile, activityId, record, dispute) {
  const data = record?.data;
  const ai = data?.source === 'ai-spec';
  return {
    flagged: !!dispute,
    flagId: dispute?.id ?? null,
    flaggedAt: dispute?.createdAt ?? null,
    reason: dispute?.reason ?? null,
    activityId: activityId ?? null,
    profile,
    activityCreatedAt: record?.createdAt ?? null,
    source: data?.source ?? (record ? 'unknown' : 'missing'),
    // Recorded per AI activity since #905; older activities have none.
    model: ai && typeof data.model === 'string' ? data.model : null,
    skillIds: ai ? data.spec?.skillIds ?? [] : data?.skillId ? [data.skillId] : [],
    prompt: ai ? (data.spec?.prompt ?? []).filter(b => b?.type === 'text').map(b => b.text).join(' ') : data?.prompt ?? null,
    spec: ai ? data.spec ?? null : null,
    // A local task is not an Activity Spec; it is kept raw and not rendered in the spec stage.
    localTask: !ai && data ? data : null,
  };
}
