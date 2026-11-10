"""Bounded production repair for acoustically invalid narration takes."""
from __future__ import annotations

import hashlib
from pathlib import Path

from providers import now, write_json
from state import read_json

POLICY = 'production-acoustic-repair-v1'

GOOD_TAKE = r'''// Production acoustic repair policy: production-acoustic-repair-v1.
// The normal three cache attempts keep their behavior. Three further attempts
// are allowed only when all three fail solely on acoustics. Repair requests
// retain the voice, text and tag, omit neighbor context, and use distinct seeds.
// Repair files never replace the shared voice cache's original takes.
export async function goodTake(dir: string, text: string, prev?: string, next?: string, voice: Voice = { id: VOICE_ID }) {
  mkdirSync(dir, { recursive: true });
  const hash = takeKey(voice, text);
  const path = join(dir, `${hash}.json`), heardPath = (k: number) => join(dir, `${hash}${k ? `.${k}` : ""}.heard.json`);
  const acoustic = (fault: string) => fault === "the voice is cut off at the end" || fault.startsWith("it clips at ");
  let spent = 0;
  let best: { take: Take; faults: string[] } | undefined;
  let last: string[] = [];
  const normalFaults: string[][] = [];
  for (let k = 0; k < TRIES; k++) {
    const file = k ? join(dir, `${hash}.${k}.json`) : path;
    let take: Take;
    if (existsSync(file)) take = JSON.parse(readFileSync(file, "utf8"));
    else {
      take = await generate(voice, text, prev, next, k ? 1000 + k : undefined);
      spent += text.length;
      writeFileSync(file, JSON.stringify(take));
    }
    const faults = await judge(text, take, heardPath(k));
    if (!faults.length) {
      if (k) writeFileSync(path, JSON.stringify(take)), writeFileSync(heardPath(0), readFileSync(heardPath(k)));
      return { take, faults, spent };
    }
    normalFaults.push(faults);
    if (!best || faults.length < best.faults.length) best = { take, faults };
    const gist = (f: string) => f.replace(/^at [\d.]+ s /, "");
    if (k > 0 && faults.some((f) => /^at [\d.]+ s the script says /.test(f) && last.includes(gist(f)))) break;
    last = faults.map(gist);
  }
  const repairEligible = normalFaults.length === TRIES && normalFaults.every(faults => faults.length > 0 && faults.every(acoustic));
  if (repairEligible) {
    const repairDir = process.env.FILM_PROD_VOICE_REPAIR_CACHE;
    if (!repairDir) throw new Error("Acoustic repair requires FILM_PROD_VOICE_REPAIR_CACHE");
    mkdirSync(repairDir, { recursive: true });
    for (let k = 3; k < 6; k++) {
      const file = join(repairDir, `${hash}.${k}.json`);
      const hearing = join(repairDir, `${hash}.${k}.heard.json`);
      let take: Take;
      if (existsSync(file)) take = JSON.parse(readFileSync(file, "utf8"));
      else {
        take = await generate(voice, text, undefined, undefined, 1000 + k);
        spent += text.length;
        writeFileSync(file, JSON.stringify(take));
      }
      const faults = await judge(text, take, hearing);
      writeFileSync(join(repairDir, `${hash}.${k}.repair.json`), JSON.stringify({
        policy: "production-acoustic-repair-v1", voice: voice.id, seed: 1000 + k,
        context: "none", attempt: k + 1, faults,
      }));
      if (!faults.length) return { take, faults, spent };
      if (!faults.every(acoustic)) throw new Error(`Acoustic repair changed the spoken words: ${faults.join("; ")}`);
    }
    throw new Error("Six takes failed the unchanged acoustic checks; narration stopped");
  }
  // A known clipped or cut-off take must never enter assembly, even when a
  // later fade could happen to make the final edit scan pass.
  if (best!.faults.some(acoustic)) throw new Error(`No acoustically valid take: ${best!.faults.join("; ")}`);
  return { take: best!.take, faults: best!.faults, spent };
}
'''


def instrument_production_voice(text):
    if f'// Production acoustic repair policy: {POLICY}.' in text:
        return text
    start = 'export async function goodTake('
    end = '\nif (process.argv[1]?.endsWith("voice.ts"))'
    if text.count(start) != 1 or text.count(end) != 1 or text.count('const TRIES = 3;') != 1:
        raise RuntimeError('Voice take-loop anchors changed; inspect the production repair policy')
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    return before+GOOD_TAKE+end+after


def migrate_voice_runtime(config, row, workspace):
    """Archive and replace only the isolated voice module after authoring ends."""
    from runtime import digest, fixed_file, verify_runtime
    if not config.get('production'):
        raise ValueError('Acoustic repair belongs only to production mode')
    root, workspace = Path(config['root']), Path(workspace)
    verify_runtime(config, row, workspace)
    for path in (root/'runs'/row['id']).glob('*.json'):
        receipt = read_json(path, {})
        if receipt.get('status') == 'running' and receipt.get('role') in ('study', 'screenplay'):
            raise RuntimeError('Finish or reconcile the active author before migrating its voice runtime')
    manifest_path = root/'films'/row['id']/'runtime-manifest.json'
    manifest = read_json(manifest_path)
    voice = workspace/'runtime/amp/film/voice.ts'
    archive = root/'runtime-migrations'/row['id']/POLICY
    if manifest.get('production_voice_policy') == POLICY:
        if f'// Production acoustic repair policy: {POLICY}.' not in voice.read_text():
            raise RuntimeError('Production voice policy marker is missing')
        return read_json(archive/'receipt.json', {'policy': POLICY, 'already_migrated': True})
    before = voice.read_text()
    after = instrument_production_voice(before)
    if before == after:
        raise RuntimeError('Unrecorded production voice policy requires reconciliation')
    entry = next(item for item in manifest['files'] if item['relative'] == 'film/voice.ts')
    before_hash = digest(voice)
    after_hash = hashlib.sha256(after.encode()).hexdigest()
    fixed_file(archive/'voice.before.ts', before)
    fixed_file(archive/'runtime-manifest.before.json', manifest_path.read_text())
    receipt = {'policy': POLICY, 'id': row['id'], 'started_at': now(), 'status': 'prepared',
               'before_sha256': before_hash, 'after_sha256': after_hash,
               'original_manifest_sha256': digest(manifest_path)}
    write_json(archive/'receipt.json', receipt)
    temporary = voice.with_suffix('.ts.tmp')
    temporary.write_text(after)
    temporary.replace(voice)
    entry['runtime_sha256'] = after_hash
    manifest['production_voice_policy'] = POLICY
    manifest['voice_retry_policy'] = ('three normal takes; at most three additional context-free takes only '
        'after acoustic-only exhaustion; transcript disagreement does not unlock repairs; '
        'known acoustic faults stop narration; repaired takes stay in private per-film storage')
    manifest['instrumentation'] = ('JSON payload snapshot and local Vite access to shared links; '
        'production acoustic repair permits three normal plus three acoustic-only repair takes '
        'without changing the source text, voice bindings, judge thresholds, or final audio gate')
    manifest['production_voice_repair'] = {
        'normal_attempts': 3, 'acoustic_only_extra_attempts': 3,
        'repair_seeds': [1003, 1004, 1005], 'repair_context': 'none',
        'shared_cache_promoted_from_repairs': False, 'acoustic_thresholds_changed': False,
    }
    write_json(manifest_path, manifest)
    verify_runtime(config, row, workspace)
    receipt.update(status='completed', finished_at=now())
    write_json(archive/'receipt.json', receipt)
    return receipt
