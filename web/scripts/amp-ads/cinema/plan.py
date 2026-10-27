"""Shot list (prompt x seeds x framings) -> a GPU-host batch: prompt files,
plan.json for the guarded batch runner, batch.env and the supervisor."""
import json
import shlex
import shutil
from pathlib import Path

from .spec import SLUG, SpecError

HERE = Path(__file__).resolve().parent
# LTX-2.5 distilled generates natively at these sizes (multiples of 64).
FRAMINGS = {
    'portrait': ('Vertical 9:16 composition, the key action in the exact centre of frame. ', 768, 1344),
    'wide': ('Widescreen 16:9 composition, the key action in the exact centre of frame. ', 1344, 768),
}
GUARD_DEFAULTS = {'START_FREE_GIB': 100, 'STOP_FREE_GIB': 24, 'EMERGENCY_FREE_GIB': 16,
                  'MAX_SECONDS': 1800, 'MAX_TEMP_C': 95}


def build(shotlist, remote_root, remote_python, remote_outputs):
    """Return (plan, prompts) where prompts maps file name -> prompt text.

    Jobs are ordered round-robin by seed, so every concept appears in the
    first hour and grading can start while the batch keeps running."""
    batch = shotlist.get('batch', '')
    prefix = shotlist.get('prefix', batch)
    if not SLUG.match(batch) or not SLUG.match(prefix):
        raise SpecError('batch and prefix must be lowercase slugs')
    model = {'runner': 'ltx-benchmark.py', 'variant': 'distilled', 'frames': 121, 'downloads': ['ltx-quality'],
             **shotlist.get('model', {})}
    if (model['frames'] - 1) % 8:
        raise SpecError('model.frames must be 8n+1 (e.g. 121 = 5 s at 24 fps)')
    seeds = shotlist.get('seeds') or []
    framings = shotlist.get('framings', ['portrait', 'wide'])
    if not seeds or any(not isinstance(s, int) for s in seeds):
        raise SpecError('seeds must be a non-empty list of integers')
    if any(f not in FRAMINGS for f in framings):
        raise SpecError(f'framings must be drawn from {sorted(FRAMINGS)}')
    style = shotlist.get('style', '')
    shots = shotlist.get('shots') or []
    if not shots:
        raise SpecError('shots must be a non-empty list')
    for s in shots:
        if not SLUG.match(s.get('id', '')) or not s.get('prompt'):
            raise SpecError('every shot needs a slug id and a prompt')
    if len({s['id'] for s in shots}) != len(shots):
        raise SpecError('shot ids must be unique')
    base = f'{remote_root}/{batch}'
    plan, prompts = [], {}
    for seed in seeds:
        for s in shots:
            if seed not in s.get('seeds', seeds):
                continue
            for framing in s.get('framings', framings):
                lead, w, h = FRAMINGS[framing]
                fname = f'{s["id"]}-{framing}.txt'
                prompts[fname] = (lead + s['prompt'].strip() + ' ' + s.get('extra', '') + ' ' + style).strip()
                name = f'{prefix}-{s["id"]}-{framing}-{seed}'
                plan.append({
                    'name': name,
                    'meta': {'shot': s['id'], 'framing': framing, 'seed': seed},
                    'downloads': model['downloads'],
                    'requiredFiles': [f'{base}/{fname}'],
                    'command': [remote_python, f'{remote_root}/{model["runner"]}', '--variant', model['variant'],
                                '--name', name, '--width', str(w), '--height', str(h),
                                '--frames', str(model['frames']), '--seed', str(seed),
                                '--prompt-file', f'{base}/{fname}'],
                })
    if len({j['name'] for j in plan}) != len(plan):
        raise SpecError('duplicate job names')
    env = {'BATCH': batch, 'PREFIX': prefix, 'AMP_SPARK_ROOT': remote_root, 'AMP_SPARK_OUTPUTS': remote_outputs,
           **{k: shotlist.get('guard', {}).get(k, v) for k, v in GUARD_DEFAULTS.items()}}
    return plan, prompts, env


def write(shotlist_path, out_dir, remote_root, remote_python, remote_outputs):
    shotlist = json.loads(Path(shotlist_path).read_text())
    plan, prompts, env = build(shotlist, remote_root, remote_python, remote_outputs)
    out = Path(out_dir)
    if (out / 'plan.json').exists():
        raise SpecError(f'{out} already holds a plan; use a new batch name (batches are append-only evidence)')
    out.mkdir(parents=True, exist_ok=True)
    for name, text in prompts.items():
        (out / name).write_text(text + '\n')
    (out / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    (out / 'batch.env').write_text(''.join(f'{k}={shlex.quote(str(v))}\n' for k, v in env.items()))
    (out / 'shotlist.json').write_text(json.dumps(shotlist, indent=2) + '\n')
    shutil.copy(HERE / 'spark' / 'supervise.sh', out / 'supervise.sh')
    return plan
