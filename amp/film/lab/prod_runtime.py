"""Production boards and blind exports using the installed review player."""
from __future__ import annotations

import argparse
import html
import json
import os
from pathlib import Path
import re
import sys

from providers import clean_environment, now, write_json
from runtime import HERE, _run, digest, pages, workspace_for
from state import read_json


def _worker(config, mode, *, identifier='', items=None):
    env = clean_environment()
    env['FILM_LAB_HEAVY'] = '1'
    command = [config['heavy'], sys.executable, str(HERE/'prod_runtime.py'), mode,
               '--config', config['_config_path']]
    if identifier:
        command += ['--id', identifier]
    if items:
        command += ['--items', str(items)]
    return _run(command, config['worktree'], env)


def capture_worker(config, items_path):
    """Read the live player's HTML/assets at capture time; never freeze a copy."""
    if not os.environ.get('FILM_LAB_HEAVY'):
        raise RuntimeError('Browser captures require the heavy-command gate')
    root = Path(config['root'])
    env = clean_environment()
    env['FILM_LAB_HEAVY'] = '1'
    result = _run([config.get('node', 'node'), '--import', 'tsx', str(HERE/'capture.ts'),
                   '--items', str(items_path), '--url', config['player_url'],
                   '--out', str(root/'boards'), '--installed'],
                  Path(config['worktree'])/'amp', env)
    if result['exit_code']:
        raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])
    for item in read_json(items_path):
        directory = root/'boards'/item['id']
        images = pages(directory/'board-wide', directory/'pages', 'wide')
        images += pages(directory/'board-tall', directory/'pages', 'tall', True)
        write_json(directory/'pages.json', images)
    return result


def make_review_item(config, row, workspace, edition=1):
    """Preserve each checked draft's estimated timeline and installed-player pixels.

    Edition 1 and edition 2 are separate, immutable review inputs. A resumed
    capture may complete an interrupted edition but cannot replace its script.
    """
    if type(edition) is not int or edition not in (1, 2):
        raise ValueError('Production reviews have initial and revised editions only')
    root, workspace = Path(config['root']), Path(workspace)
    source = workspace/'check-output'/row['id']/'lab-payload.json'
    payload = read_json(source)
    if not payload or payload.get('timing_source') != 'estimated':
        raise RuntimeError('A production review needs a checked estimated timeline')
    if payload.get('script') != read_json(workspace/'screenplay.json'):
        raise RuntimeError('Review payload does not match the current screenplay')
    check = read_json(workspace/'check.json', {})
    if not check.get('passed') or check.get('screenplay_sha256') != digest(workspace/'screenplay.json'):
        raise RuntimeError('Review screenplay has no current passing kit check')
    facts = read_json(root/'facts'/(row['type']+'.json'))
    payload.update(problemType=row['type'], grade=facts['skill']['grade'],
                   skill=facts['skill']['id'], skillTitle=facts['skill']['title'],
                   standards=[standard['code'] for standard in facts['standards']])
    identifier = row['id']+'-review-'+str(edition)
    path = root/'films'/row['id']/f'review-{edition}'/'payload.json'
    prior = read_json(path)
    if prior is not None and prior != payload:
        raise RuntimeError('Review edition already contains a different screenplay')
    if prior is None:
        write_json(path, payload)
    item_path = root/'review-items'/(identifier+'.json')
    saved = read_json(item_path)
    if saved and all(Path(p).is_file() for p in saved['images']):
        return saved
    job = root/'capture-jobs'/(identifier+'.json')
    write_json(job, [{'id': identifier, 'payload': str(path)}])
    result = _worker(config, 'capture-worker', items=job)
    write_json(job.with_name(identifier+'-run.json'), result)
    if result['exit_code']:
        raise RuntimeError(result['stderr'][-6000:] or result['stdout'][-6000:])
    item = {'id': identifier, 'payload': str(path),
            'images': read_json(root/'boards'/identifier/'pages.json')}
    if not item['images'] or not all(Path(p).is_file() for p in item['images']):
        raise RuntimeError('Production capture did not supply all storyboard pages')
    write_json(item_path, item)
    return item


def _grade_title(grade):
    if grade == 'K':
        return 'Kindergarten'
    if grade.isdigit():
        return 'Grade '+grade
    return {'algebra-1': 'Algebra 1', 'geometry': 'Geometry', 'algebra-2': 'Algebra 2',
            'precalculus': 'Precalculus', 'statistics': 'Statistics'}.get(grade, grade.replace('-', ' ').title())


def page_rows(config):
    """Only this allowlisted shape may leave the private assignment directory."""
    root, data = Path(config['root']), Path(config['live_data'])
    assignments = read_json(root/'arms.json')['assignments']
    index = {row['id']: row for row in read_json(data/'index.json', [])}
    rows = []
    for assignment in assignments:
        public = index.get(assignment['id'])
        if not public:
            continue
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*--[a-z]{2}', assignment['id']):
            raise ValueError('Invalid production blind ID')
        facts = read_json(root/'facts'/(assignment['type']+'.json'))
        rows.append({'id': assignment['id'], 'type': assignment['type'],
                     'type_title': facts['template']['title'], 'title': public['title'],
                     'grade': str(assignment.get('grade', public.get('grade', facts['skill']['grade']))),
                     'seconds': public['seconds'], 'added': public.get('added', '')})
    return rows


def grouped_page(config):
    """Group by curriculum order and type; expose no model or sibling labels."""
    data = Path(config['live_data'])
    rows = page_rows(config)
    groups = {}
    for row in rows:
        groups.setdefault(row['grade'], {}).setdefault(row['type'], []).append(row)
    cards = []
    for grade, types in groups.items():
        cards.append('<section class="grade"><h2>'+html.escape(_grade_title(grade))+'</h2>')
        for siblings in types.values():
            cards.append('<section class="type"><h3>'+html.escape(siblings[0]['type_title'])+'</h3>')
            for row in sorted(siblings, key=lambda value: value['id']):
                identifier = row['id']
                minutes, seconds = divmod(round(row['seconds']), 60)
                cards.append(f'<article data-film="{identifier}"><a class="film" href="./?id={identifier}">'
                             f'<span>{html.escape(row["title"])}<small>{identifier[-2:].upper()}</small></span>'
                             f'<span class="duration">{minutes}:{seconds:02}</span></a>'
                             f'<p class="details"><span class="status" id="status-{identifier}">Unreviewed</span>'
                             f'<span class="new" id="new-{identifier}" hidden>New</span></p></article>')
            cards.append('</section>')
        cards.append('</section>')
    payload = json.dumps(rows, ensure_ascii=False).replace('<', '\\u003c')
    page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>AMP lesson films</title>
<style>body{margin:0;background:#f5f3ed;color:#172c35;font:17px/1.5 system-ui,sans-serif}main{max-width:850px;margin:auto;padding:28px 18px 64px}h1{font-size:30px;line-height:1.15;margin:0 0 18px}h2{font-size:27px;line-height:1.2;margin:40px 0 16px}h3{font-size:21px;line-height:1.3;margin:0}.intro{max-width:680px}.type{background:white;border:1px solid #d7dfdc;border-radius:14px;padding:20px;margin:18px 0}.film{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:44px;padding:10px 14px;margin-top:14px;color:#075f64;background:#e7f4ef;border-radius:9px;text-decoration:none;font-weight:650}.film>span:first-child{min-width:0;overflow-wrap:anywhere}.film small{display:block;font-size:12px;font-weight:500;color:#4f6267;letter-spacing:.07em}.duration{white-space:nowrap;font-variant-numeric:tabular-nums}.film:focus-visible,a:focus-visible{outline:3px solid #a85b21;outline-offset:4px}a{color:#075f64}.details{display:flex;align-items:center;gap:12px;font-size:14px;color:#4f6267;margin:8px 0 0}.approved{color:#176440}.rejected{color:#9a3b1e}.new{background:#fff0c6;color:#714b08;border-radius:5px;padding:1px 7px;font-weight:650}[hidden]{display:none!important}@media(max-width:400px){main{padding:22px 14px 48px}.type{padding:16px}.film{gap:10px}}</style>
<main><h1>AMP lesson films</h1><p class="intro">Lessons follow curriculum order. Versions of the same problem type appear together. Open a film to watch, approve or reject it, and leave a note.</p><p id="count">'''+str(len(rows))+''' films available.</p><p><a href="./">All lesson films</a> · <a href="./lab.html">Model comparison</a></p>'''+''.join(cards)+'''</main><script>
const films='''+payload+''';
const filmLabel=films.length===1?'film':'films';
const seenKey='amp-production-films-seen';
let seen={};try{seen=JSON.parse(localStorage.getItem(seenKey)||'{}');if(!seen||typeof seen!=='object'||Array.isArray(seen))seen={};}catch{}
const newest=Math.max(0,...films.map(f=>Date.parse(f.added)||0));
for(const film of films){const added=Date.parse(film.added)||0;document.getElementById('new-'+film.id).hidden=seen[film.id]===film.added||!added||added<newest-86400000;const link=document.querySelector('[data-film="'+film.id+'"] a');link.addEventListener('click',()=>{seen[film.id]=film.added;try{localStorage.setItem(seenKey,JSON.stringify(seen));}catch{}document.getElementById('new-'+film.id).hidden=true;});}
async function refresh(){try{const response=await fetch('data/grades.json?t='+Date.now());if(!response.ok)throw Error();const grades=await response.json();let count=0;for(const film of films){const entry=grades[film.id];const current=entry&&(!entry.added||entry.added===film.added);const state=current&&['approved','rejected'].includes(entry.grade)?entry.grade:'unreviewed';const label=document.getElementById('status-'+film.id);label.textContent=state[0].toUpperCase()+state.slice(1);label.className='status '+state;if(state!=='unreviewed')count++;}document.getElementById('count').textContent=films.length+' '+filmLabel+' available; '+count+' graded.';}catch{document.getElementById('count').textContent=films.length+' '+filmLabel+' available. Grades could not be refreshed.';}}
refresh();setInterval(refresh,60000);
setTimeout(()=>location.reload(),300000);
</script></html>'''
    data.parent.mkdir(parents=True, exist_ok=True)
    path = data.parent/'prod.html'
    temporary = path.with_suffix('.html.tmp')
    temporary.write_text(page)
    temporary.replace(path)
    return len(rows)


def export_worker(config, row, workspace):
    from live_export import export_worker as export
    result = read_json(Path(config['root'])/'films'/row['id']/'voice-run.json',{})
    if result.get('exit_code') != 0:
        raise RuntimeError('Voiced timing has no passing kit check; export stopped')
    return export(config, row, workspace, page_builder=grouped_page)


def export_film(config, row, workspace):
    result = _worker(config, 'export-worker', identifier=row['id'])
    write_json(Path(config['root'])/'films'/row['id']/'export-run.json', result)
    if result['exit_code']:
        return {'exported': False, 'error': result['stderr'][-6000:] or result['stdout'][-6000:]}
    return read_json(Path(config['root'])/'films'/row['id']/'export.json')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=('capture-worker', 'export-worker', 'page'))
    parser.add_argument('--config', required=True)
    parser.add_argument('--id')
    parser.add_argument('--items')
    args = parser.parse_args()
    config = read_json(args.config)
    config['_config_path'] = str(Path(args.config).resolve())
    if args.mode == 'page':
        result = {'films': grouped_page(config)}
    elif args.mode == 'capture-worker':
        result = capture_worker(config, args.items)
    else:
        row = next(row for row in read_json(Path(config['root'])/'arms.json')['assignments'] if row['id']==args.id)
        result = export_worker(config, row, workspace_for(config, row['id']))
    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
