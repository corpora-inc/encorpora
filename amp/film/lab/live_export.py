"""Publish blind live-player artifacts locally, preserving the grading service."""
from __future__ import annotations
import hashlib
import html
import json
import os
from pathlib import Path
import shutil
import subprocess
import urllib.request

from providers import clean_environment, now, write_json
from state import coordinator_lock, read_json

NAMES = {'XescS24CsOySAkKrLAO3': 'Madeline', 'J3Ei0Lj6fAobhIqY5ySH': 'Paul', 'SYXbTJsLE7zmSjr1DchT': 'Champ'}
ALLOWED = {'id', 'title', 'problemType', 'skill', 'skillTitle', 'grade', 'strand', 'standards', 'script', 'timing', 'figure'}
MARKER = '<!-- film-lab-navigation -->'


def instrument_export_paths(source):
    """File URLs must be decoded before reading a screenplay on disk."""
    anchor = 'const here = new URL(".", import.meta.url).pathname;'
    if source.count(anchor) != 1:
        raise RuntimeError('Export directory anchor changed; inspect the kit')
    return 'import { fileURLToPath } from "node:url";\n'+source.replace(
        anchor, 'const here = fileURLToPath(new URL(".", import.meta.url));')


def migrate_export_paths(config, row, workspace):
    """Preserve frozen sources; record a narrowly scoped runtime path repair."""
    from runtime import digest, fixed_file, verify_runtime
    verify_runtime(config, row, workspace)
    root = Path(config['root'])
    path = root/'films'/row['id']/'runtime-manifest.json'
    manifest = read_json(path)
    if manifest.get('export_path_policy') == 'decoded-file-url':
        return
    for receipt in (root/'runs'/row['id']).glob('*.json'):
        record = read_json(receipt, {})
        if record.get('status') == 'running' and record.get('role') == 'screenplay':
            raise RuntimeError('Finish the author before migrating its export runtime')
    module = Path(workspace)/'runtime/amp/film/export-live.ts'
    before = module.read_text()
    after = instrument_export_paths(before)
    archive = root/'runtime-migrations'/row['id']/'decoded-file-url'
    fixed_file(archive/'export-live.before.ts', before)
    fixed_file(archive/'runtime-manifest.before.json', path.read_text())
    temporary = module.with_suffix('.ts.tmp')
    temporary.write_text(after)
    temporary.replace(module)
    entry = next(e for e in manifest['files'] if e['relative'] == 'film/export-live.ts')
    entry['runtime_sha256'] = digest(module)
    manifest['export_path_policy'] = 'decoded-file-url'
    write_json(path, manifest)
    verify_runtime(config, row, workspace)
    write_json(archive/'receipt.json', {'at': now(), 'policy': 'decoded-file-url',
               'before_sha256': hashlib.sha256(before.encode()).hexdigest(),
               'after_sha256': digest(module)})


def player_copy(payload):
    value = {key: payload[key] for key in ALLOWED if key in payload}
    value = json.loads(json.dumps(value))
    for role in value['script'].get('cast', {}):
        voice = value['timing']['voices'][role]
        if voice not in NAMES:
            raise ValueError('Unapproved playback voice')
        value['script']['cast'][role] = {'voice': voice, 'name': NAMES[voice],
                                       **({'tag': '[energetic]'} if role=='learner' else {})}
    return value


def grouped_page(config):
    root, data = Path(config['root']), Path(config['live_data'])
    assignments = read_json(root/'arms.json')['assignments']
    index = {row['id']: row for row in read_json(data/'index.json', [])}
    rows = []
    for assignment in assignments:
        if assignment['id'] not in index:
            continue
        public = index[assignment['id']]
        facts = read_json(root/'facts'/(assignment['type']+'.json'))
        # This is the only row shape embedded in the page. No arm or model field.
        rows.append({'id': assignment['id'], 'type': assignment['type'],
                     'type_title': facts['template']['title'], 'title': public['title'],
                     'grade': public.get('grade', ''), 'seconds': public['seconds'], 'added': public.get('added', '')})
    rows.sort(key=lambda row: (row['type_title'].casefold(), row['id']))
    cards = []
    for row in rows:
        title, identifier = html.escape(row['type_title']), html.escape(row['id'])
        minutes, seconds = divmod(int(row['seconds']), 60)
        cards.append(f'<section data-film="{identifier}"><h2>{title}</h2><p class="meta">{html.escape(row["type"])} · {html.escape(str(row["grade"]))}</p><a class="film" href="./?id={identifier}"><span>{html.escape(row["title"])}</span><span>{minutes}:{seconds:02}</span></a><p class="status" id="status-{identifier}">Unreviewed</p></section>')
    payload = json.dumps(rows, ensure_ascii=False).replace('<', '\\u003c')
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Lesson films by problem type</title>
<style>body{margin:0;background:#f5f3ed;color:#172c35;font:17px/1.5 system-ui,sans-serif}main{max-width:850px;margin:auto;padding:28px 18px 64px}h1{font-size:30px;line-height:1.15;margin:0 0 18px}h2{font-size:21px;margin:0}.intro{max-width:680px}.meta,.status{font-size:14px;color:#4f6267;margin:6px 0}section{background:white;border:1px solid #d7dfdc;border-radius:14px;padding:20px;margin:18px 0}.film{display:flex;justify-content:space-between;gap:20px;padding:14px 16px;margin-top:14px;color:#075f64;background:#e7f4ef;border-radius:9px;text-decoration:none;font-weight:650}.film:focus-visible,a:focus-visible{outline:3px solid #a85b21;outline-offset:4px}a{color:#075f64}.status{margin:12px 0 0}.approved{color:#176440}.rejected{color:#9a3b1e}</style>
<main><h1>Lesson films by problem type</h1><p class="intro">Open each film, approve or reject it in the player, and leave a note. Grade every version of a type. Grading even two types fully gives signal.</p><p id="count">'''+str(len(rows))+''' films available.</p><p><a href="./">All lesson films</a></p>'''+''.join(cards)+'''</main><script>
const films='''+payload+''';
async function refresh(){try{const response=await fetch('data/grades.json?t='+Date.now());const grades=await response.json();let count=0;for(const film of films){const entry=grades[film.id];const current=entry&&(!entry.added||entry.added===film.added);const state=current&&['approved','rejected'].includes(entry.grade)?entry.grade:'unreviewed';const label=document.getElementById('status-'+film.id);label.textContent=state[0].toUpperCase()+state.slice(1);label.className='status '+state;if(state!=='unreviewed')count++;}document.getElementById('count').textContent=films.length+' films available; '+count+' graded.';}catch{}}
refresh();setInterval(refresh,60000);
</script></html>'''
    path = data.parent/'lab.html'
    temporary = path.with_suffix('.html.tmp')
    temporary.write_text(page)
    temporary.replace(path)
    # Add a link to the existing catalog without rebuilding its grading UI.
    index_path = data.parent/'index.html'
    existing = index_path.read_text()
    if MARKER not in existing:
        backup = root/'live-index-before-navigation.html'
        if not backup.exists():
            backup.write_text(existing)
        navigation = MARKER+'''<script>if(!new URLSearchParams(location.search).has('id')){const add=()=>{const title=document.querySelector('.live-index h1');if(!title)return false;const link=document.createElement('a');link.href='./lab.html';link.className='live-link';link.textContent='Review new films by type';title.after(link);return true;};if(!add()){const observer=new MutationObserver(()=>{if(add())observer.disconnect();});observer.observe(document.documentElement,{childList:true,subtree:true});}}</script>'''
        if existing.count('</body>') != 1:
            raise RuntimeError('Review index has an unexpected shape; grouped page was written but navigation was not changed')
        temporary = index_path.with_suffix('.html.tmp')
        temporary.write_text(existing.replace('</body>', navigation+'</body>'))
        temporary.replace(index_path)
    return len(rows)


def export_worker(config, row, workspace, *, page_builder=grouped_page):
    if not os.environ.get('FILM_LAB_HEAVY'):
        raise RuntimeError('Audio export requires the heavy-command gate')
    from runtime import validate_cast
    migrate_export_paths(config, row, workspace)
    validate_cast(Path(workspace)/'screenplay.json', row['id'])
    root, data = Path(config['root']), Path(config['live_data'])
    stage = root/'export-staging'/row['id']
    stage.mkdir(parents=True, exist_ok=True)
    runtime = Path(workspace)/'runtime/amp'
    env = clean_environment()
    env['FILM_OUT'] = str(root/'voiced')
    result = subprocess.run([config.get('node', 'node'), '--import', 'tsx', str(runtime/'film/export-live.ts'),
                             str(stage), row['id']], cwd=runtime, env=env, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-6000:] or result.stdout[-6000:])
    emitted = read_json(stage/(row['id']+'.json'))
    if emitted['script'] != read_json(Path(workspace)/'screenplay.json'):
        raise RuntimeError('Export does not contain the checked screenplay')
    expected = {'teacher': row['teacher'], 'learner': 'SYXbTJsLE7zmSjr1DchT'}
    if emitted['timing'].get('voices') != expected:
        raise RuntimeError('Exported voices differ from the production assignment')
    payload = player_copy(emitted)
    index_row = next(r for r in read_json(stage/'index.json') if r['id']==row['id'])
    destination = data/(row['id']+'.json')
    with coordinator_lock(root/'live-export.lock'):
        existing = read_json(destination)
        if existing is not None and existing != payload:
            raise RuntimeError('A different live edition already uses this blind ID')
        audio = data/(row['id']+'.m4a')
        temporary = audio.with_suffix('.m4a.tmp')
        shutil.copyfile(stage/(row['id']+'.m4a'), temporary)
        temporary.replace(audio)
        write_json(destination, payload)
        index = read_json(data/'index.json', [])
        prior = next((r for r in index if r['id']==row['id']), None)
        if prior:
            index_row['added'] = prior.get('added', index_row['added'])
            index[index.index(prior)] = index_row
        else:
            index.append(index_row)
        write_json(data/'index.json', index)
        page_builder(config)
    base = config['player_url'].rstrip('/')+'/data/'
    with urllib.request.urlopen(base+row['id']+'.json', timeout=20) as response:
        if json.load(response) != payload:
            raise RuntimeError('Live payload readback differs')
    request = urllib.request.Request(base+row['id']+'.m4a', method='HEAD')
    with urllib.request.urlopen(request, timeout=20) as response:
        if int(response.headers.get('Content-Length', 0)) != audio.stat().st_size:
            raise RuntimeError('Live audio readback has the wrong size')
    with urllib.request.urlopen(base+'index.json', timeout=20) as response:
        if not any(r['id']==row['id'] for r in json.load(response)):
            raise RuntimeError('Live index does not list the film')
    receipt = {'exported': True, 'id': row['id'], 'at': now(), 'added': index_row['added'],
               'json_sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
               'audio_sha256': hashlib.sha256(audio.read_bytes()).hexdigest()}
    write_json(root/'films'/row['id']/'export.json', receipt)
    return receipt


def export_film(config, row, workspace):
    from runtime import heavy
    result = heavy(config, 'export-worker', row['id'])
    write_json(Path(config['root'])/'films'/row['id']/'export-run.json', result)
    if result['exit_code']:
        return {'exported': False, 'error': result['stderr'][-6000:] or result['stdout'][-6000:]}
    return read_json(Path(config['root'])/'films'/row['id']/'export.json')
