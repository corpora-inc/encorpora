"""Offline HTML pages: a grading gallery for raw generated clips, and a review
page for finished ads. Grades and notes stay in the browser until exported."""
import html
import json
import re
from pathlib import Path

CSS = """:root{--bg:#0e1116;--card:#171b22;--fg:#eef2f5;--mut:#93a1ad;--acc:#e8b24a;--ok:#4caf50;--line:#2a313b}
@media (prefers-color-scheme:light){:root{--bg:#f6f7f8;--card:#fff;--fg:#141a20;--mut:#5b6773;--line:#d9dee3}}
*{box-sizing:border-box}body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.45 system-ui,sans-serif}
header{position:sticky;top:0;z-index:2;background:var(--bg);padding:8px 0 12px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
h1{font-size:18px;margin:0}h2{font-size:16px;margin:28px 0 8px}small,.mut{color:var(--mut)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
figure{margin:0;background:var(--card);border:2px solid var(--line);border-radius:10px;overflow:hidden}
figure[data-grade=A]{border-color:var(--ok)}figure[data-grade=B]{border-color:var(--acc)}figure[data-grade=X]{opacity:.4}
video{display:block;width:100%;max-height:420px;background:#000}
figcaption{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:8px;font-size:12px;color:var(--mut)}
button{min-width:44px;min-height:44px;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:8px;font:inherit;cursor:pointer}
button.on{background:var(--acc);color:#000;border-color:var(--acc)}
textarea{width:100%;min-height:72px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:8px;font:inherit}
.ad{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:16px 0}
.formats{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;align-items:start}.ad h2{margin-top:0}
.badge{display:inline-block;padding:2px 8px;border-radius:99px;border:1px solid var(--line);font-size:12px}
.bad{color:#e57373}"""

GRADE_JS = """const KEY='amp-cinema-grades:'+document.title;let g={};try{g=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const out=document.getElementById('out');
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(g))}catch(e){}out.value=Object.entries(g).map(([k,v])=>v+' '+k).sort().join('\\n')};
document.querySelectorAll('figure').forEach(f=>{const id=f.dataset.id,v=f.querySelector('video');
 const paint=()=>{f.dataset.grade=g[id]||'';f.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on',b.dataset.v===g[id]))};
 f.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{if(g[id]===b.dataset.v)delete g[id];else g[id]=b.dataset.v;paint();save()});
 v.onmouseenter=()=>v.play().catch(()=>{});v.onmouseleave=()=>v.pause();
 v.onclick=()=>{v.muted=!v.muted;v.currentTime=0;v.play().catch(()=>{})};paint()});
document.getElementById('dl').onclick=()=>{save();const a=document.createElement('a');
 a.href=URL.createObjectURL(new Blob([JSON.stringify(g,null,2)],{type:'application/json'}));a.download='grades.json';a.click()};
save();"""


def page(title, body, script=''):
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1"><title>{html.escape(title)}</title>'
            f'<style>{CSS}</style></head><body>{body}<script>{script}</script></body></html>')


def _parse(name):
    """Older plans carry no meta: read <prefix>-<shot>-<framing>-<seed> from the name."""
    m = re.match(r'^[a-z0-9]+-(.+)-(portrait|wide)-(\d+)$', name)
    return {'shot': m[1], 'framing': m[2], 'seed': int(m[3])} if m else {}


def clips(batch_dir):
    """Grading gallery for <batch_dir>/clips, grouped by shot using plan.json."""
    d = Path(batch_dir)
    plan = json.loads((d / 'plan.json').read_text()) if (d / 'plan.json').exists() else []
    meta = {j['name']: j.get('meta') or _parse(j['name']) for j in plan}
    groups = {}
    for clip in sorted((d / 'clips').glob('*.mp4')):
        m = meta.get(clip.stem)
        if plan and m is None:
            continue
        groups.setdefault((m or {}).get('shot', clip.stem), []).append((clip, m or {}))
    status = (d / 'spark-status.txt').read_text().strip() if (d / 'spark-status.txt').exists() else ''
    sections = []
    for shot, items in groups.items():
        figs = ''.join(
            f'<figure data-id="{html.escape(c.stem, quote=True)}"><video src="clips/{html.escape(c.name, quote=True)}" '
            f'muted loop playsinline preload="metadata"></video><figcaption><span>{html.escape(m.get("framing", ""))} '
            f'· seed {m.get("seed", "?")}</span><span>' +
            ''.join(f'<button data-v="{v}">{v}</button>' for v in 'ABCX') + '</span></figcaption></figure>'
            for c, m in items)
        sections.append(f'<h2>{html.escape(shot)} <small>{len(items)}</small></h2><div class="grid">{figs}</div>')
    title = d.name
    body = (f'<header><h1>{html.escape(title)}</h1><span class="mut">{sum(len(v) for v in groups.values())} of '
            f'{len(plan) or "?"} clips · {html.escape(status)}</span><span class="mut">Hover plays, click for sound. '
            f'A use · B maybe · C weak · X reject.</span><button id="dl">Download grades</button></header>'
            f'<textarea id="out" readonly aria-label="Grades"></textarea>{"".join(sections)}')
    (d / 'review.html').write_text(page(title, body, GRADE_JS))
    return d / 'review.html'


def ads(out_root):
    """Review page for finished ads under out_root/<ad-id>/<format>-receipt.json."""
    root = Path(out_root)
    blocks = []
    for ad in sorted(p for p in root.iterdir() if p.is_dir()):
        receipts = sorted(ad.glob('*-receipt.json'))
        receipts = [r for r in receipts if r.name != 'audio-receipt.json']
        if not receipts:
            continue
        first = json.loads(receipts[0].read_text())
        figs = []
        for r in receipts:
            data = json.loads(r.read_text())
            name = r.name[:-len('-receipt.json')]
            cls = '' if data['status'] == 'ready-for-review' else ' bad'
            figs.append(f'<figure><video controls playsinline preload="none" poster="{ad.name}/{name}-contact.jpg" '
                        f'src="{ad.name}/{name}.mp4"></video><figcaption><span>{html.escape(data["aspect"])} '
                        f'{data["dimensions"][0]}×{data["dimensions"][1]}</span><span class="badge{cls}">'
                        f'{html.escape(data["status"])}</span></figcaption></figure>')
        blocks.append(f'<section class="ad"><h2>{html.escape(first.get("title") or ad.name)}</h2>'
                      f'<p class="mut">{html.escape(ad.name)} · {html.escape(str(first.get("voice") or "no voice"))} · '
                      f'{html.escape(str(first.get("music") or "no music"))}</p>'
                      f'<p>{html.escape(first.get("script") or "")}</p><div class="formats">{"".join(figs)}</div></section>')
    body = ('<header><h1>AMP ads for review</h1><span class="mut">Private. Nothing here is published.</span>'
            '</header>' + ''.join(blocks))
    (root / 'review.html').write_text(page('AMP ads for review', body))
    return root / 'review.html'
