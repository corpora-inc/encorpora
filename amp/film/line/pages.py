"""Private production pages; model attribution is omitted until a current score exists."""
import html
import json
import math
import os
from urllib.parse import quote
from pathlib import Path

from state import read_json


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def recipes(config):
    root = Path(config.get('line_root', config['root']))
    return sorted((read_json(p) for p in root.glob('*/recipe.json')),
                  key=lambda r: (r['started_at'], r['id']), reverse=True)


def write_page(config, name, title, body, *, destination=None):
    source = Path(config['worktree'])/'amp'
    # Reuse the review desk's actual tokens and CSS, including focus states.
    css = (source/'src/web/ui/tokens.css').read_text()+'\n'+(source/'film/review.css').read_text()
    css += '''
html,body{height:auto;overflow:auto}main.panel{display:block;max-width:1100px;width:auto;margin:auto;overflow:visible}
a{color:var(--color-figure-accent);overflow-wrap:anywhere}nav a,.film{display:inline-flex;align-items:center;min-height:44px;min-width:44px}
section{padding:16px 0;border-bottom:1px solid var(--color-border)}h2{font-size:20px}p{overflow-wrap:anywhere}
table{table-layout:fixed;width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--color-border);vertical-align:top;overflow-wrap:anywhere}
small{display:block;color:var(--color-muted-text)}.note{white-space:pre-wrap}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(150px,100%),1fr));gap:12px}
@media(max-width:767px){table,tbody,tr,td{display:block}thead{display:none}tr{padding:16px 0;border-bottom:1px solid var(--color-border)}td{border:0;padding:4px 0}td:before{content:attr(data-label) ': ';font-weight:650}}
'''
    page = ('<!doctype html><html lang="en"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>'+html.escape(title)+'</title><script>'
            'const theme=matchMedia("(prefers-color-scheme: dark)");'
            'const paint=()=>document.documentElement.dataset.theme=theme.matches?"dark":"light";'
            'paint();theme.addEventListener("change",paint);</script><style>'+css+'</style>'
            '<main class="panel"><h1>'+html.escape(title)+'</h1>'+body+'</main></html>')
    path = Path(destination) if destination else Path(config['live_data']).parent/(name+'.html')
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.html.tmp')
    temporary.write_text(page)
    temporary.replace(path)
    return path



def queue_location(config):
    if not config.get('queue_page'):
        raise ValueError('Set queue_page to the review site root HTML file')
    return Path(config['queue_page'])


def relative_url(path, parent):
    return quote(os.path.relpath(path, parent).replace(os.sep, '/'), safe='/')


def script_json(value):
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')


def line_page(config):
    rows = read_json(Path(config['live_data'])/'queue.json', [])
    location = queue_location(config)
    queue = relative_url(location.parent if location.name == 'index.html' else location, Path(config['live_data']).parent)
    if location.name == 'index.html':
        queue += '/'
    body = '<p><a class="film" href="'+html.escape(queue, quote=True)+'">Review queue</a></p>'
    body += '<script>const films='+script_json(rows)+';location.replace('+script_json(queue)+');</script>'
    write_page(config, 'line', 'Review queue', body)
    return len(rows)


def queue_page(config):
    path = queue_location(config)
    data = Path(config['live_data'])
    if not (data/'queue.json').exists():
        from providers import write_json
        write_json(data/'queue.json', [])
    live = Path(config['live_data']).parent
    urls = {'queue': relative_url(Path(config['live_data'])/'queue.json', path.parent),
            'reviews': relative_url(live/'review', path.parent),
            'review': relative_url(live/'review.html', path.parent)}
    body = '''<style>
.q-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid var(--color-border)}
.q-main{min-width:0;flex:1}.q-row a{font-size:18px;font-weight:600;min-height:44px;min-width:44px;display:inline-flex;align-items:center;text-decoration:none;color:var(--color-on-surface)}
.q-row a:hover,.q-row a:focus-visible{text-decoration:underline}
.q-meta,.q-side{color:var(--color-muted-text);font-size:14px}.q-meta{margin-top:2px}
.q-side{flex:none;text-align:right;font-variant-numeric:tabular-nums}
.q-row a.q-watch{box-sizing:border-box;padding:0 18px;border-radius:999px;background:var(--color-primary);color:var(--color-on-primary);font-size:16px}
.q-row a.q-watch:hover{background:var(--color-primary-hover)}.q-list{min-height:60px}footer a{display:inline-flex;align-items:center;min-height:44px;min-width:44px}
.q-empty{color:var(--color-muted-text);padding:14px 0}h2{margin:28px 0 4px}
</style><p>The review queue. Watch a film, give it one score and a note.</p>
<h2>Waiting for your score</h2><div class="q-list" id="waiting" aria-live="polite"><p class="q-empty">Loading…</p></div>
'''
    body += '<script>const urls='+script_json(urls)+';'+(Path(__file__).parent/'queue.js').read_text()+'</script>'
    if (live/'board.html').exists():
        body += '<footer><a href="'+html.escape(relative_url(live/'board.html', path.parent), quote=True)+'">Scoreboard</a></footer>'
    return write_page(config, 'queue', 'AMP lesson films', body, destination=path)

def founder_score(identifier, public, reviews, grades):
    def current(entry):
        return entry if isinstance(entry, dict) and public and (
            not entry.get('added') or entry['added'] == public.get('added')) else {}
    review = current(reviews.get(identifier))
    grade = current(grades.get(identifier))
    # A current review supersedes legacy grading, including an explicitly cleared score.
    entry = review or grade
    score = entry.get('score', entry.get('grade'))
    note = entry.get('summary') or entry.get('note') or ''
    return (score if number(score) and 0 <= score <= 10 else None), note


METRICS = {'score': 'Founder score', 'prediction': 'Director score', 'dollars': 'Model dollars',
           'tokens': 'Tokens', 'characters': 'Voice characters', 'credits': 'Confirmed voice credits',
           'reserved': 'Reserved voice credits', 'minutes': 'Processing minutes'}


def board_rows(config):
    data = Path(config['live_data'])
    index = {r['id']: r for r in read_json(data/'queue.json', [])}
    reviews, grades = read_json(data/'reviews.json', {}), read_json(data/'grades.json', {})
    predictions = read_json(Path(config['root'])/'predictions.json', {})
    rows = []
    for recipe in recipes(config):
        identifier = recipe['id']
        if identifier not in index:
            continue
        score, note = founder_score(identifier, index.get(identifier), reviews, grades)
        cost, tokens = recipe.get('cost', {}), recipe.get('tokens') or {}
        components = [tokens.get(k) for k in ('input_uncached', 'input_cached', 'cache_write', 'output')]
        prediction = predictions.get(identifier, {})
        row = {'id': identifier, 'title': index[identifier]['title'], 'status': recipe['status'],
               'score': score, 'note': note, 'prediction': prediction.get('score'),
               'reason': prediction.get('reason', ''),
               'author': f'{recipe["model"]} / {recipe["effort"]}' if score is not None else 'Awaiting founder score',
               'dollars': cost.get('known_model_dollars') if cost.get('model_receipts_without_full_dollars') == 0 else None,
               'partial_dollars': cost.get('known_model_dollars'),
               'tokens': recipe.get('external_usage', {}).get('tokens') if recipe.get('adopted') else sum(components) if all(number(n) for n in components) and recipe.get('usage_complete') else None,
               'characters': cost.get('voice_input_characters'), 'credits': cost.get('voice_confirmed_credits'),
               'reserved': cost.get('voice_reserved_credits'),
               'minutes': (recipe['total_seconds']/60 + (recipe.get('external_usage', {}).get('minutes') or 0)) if number(recipe.get('total_seconds')) else None}
        rows.append(row)
    return rows


def averages(rows):
    result = {}
    for key in METRICS:
        values = [r[key] for r in rows[:10] if number(r.get(key))]
        result[key] = {'value': sum(values)/len(values) if values else None, 'count': len(values)}
    return result


def display(value, dollars=False):
    if not number(value):
        return 'Unavailable'
    return ('$' if dollars else '')+f'{value:,.2f}'.rstrip('0').rstrip('.')


def board(config):
    rows = board_rows(config)
    body = '<nav><a href="line.html">Review films</a></nav><h2>Last 10 films</h2>'
    body += '<p>n counts available measurements. Dollars cover models; minutes cover processing. '
    body += 'Regenerate with the board command after scoring.</p><div class="metrics">'
    for key, value in averages(rows).items():
        body += f'<div>{METRICS[key]}<strong><small>{display(value["value"], key == "dollars")} (n={value["count"]})</small></strong></div>'
    body += '</div><h2>Films</h2><table><thead><tr><th>Film</th><th>Founder</th><th>Director</th><th>Author</th><th>Usage</th></tr></thead><tbody>'
    for row in rows:
        identifier = html.escape(row['id'], quote=True)
        cells = {
            'Film': f'<a class="film" href="review.html?id={identifier}&amp;list=line">{html.escape(row["title"])}</a><small>{identifier} · {html.escape(row["status"])}</small>',
            'Founder': (display(row['score']) if row['score'] is not None else 'Unscored')
                       + ('<p class="note">'+html.escape(row['note'])+'</p>' if row['note'] else ''),
            'Director': display(row['prediction'])
                        + ('<p class="note">'+html.escape(row['reason'])+'</p>' if row['reason'] else ''),
            'Author': html.escape(row['author']),
        }
        money = display(row['dollars'], True)
        if row['dollars'] is None and number(row['partial_dollars']) and row['partial_dollars'] > 0:
            money = 'At least '+display(row['partial_dollars'], True)+' (incomplete)'
        cells['Usage'] = money+' model dollars; voice dollars unavailable'
        for key in ('tokens', 'characters', 'credits', 'reserved', 'minutes'):
            cells['Usage'] += '<small>'+display(row[key])+' '+METRICS[key].lower()+'</small>'
        body += '<tr>'+''.join(f'<td data-label="{label}">{value}</td>' for label, value in cells.items())+'</tr>'
    path = write_page(config, 'board', 'Film production board', body+'</tbody></table>')
    queue_page(config)
    return path
