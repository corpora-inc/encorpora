"""Private production pages; model attribution is omitted until a current score exists."""
import html
import json
import math
from pathlib import Path

from state import read_json


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def recipes(config):
    root = Path(config.get('line_root', config['root']))
    return sorted((read_json(p) for p in root.glob('*/recipe.json')),
                  key=lambda r: (r['started_at'], r['id']), reverse=True)


def write_page(config, name, title, body):
    source = Path(config['worktree'])/'amp'
    # Reuse the review desk's actual tokens and CSS, including focus states.
    css = (source/'src/web/ui/tokens.css').read_text()+'\n'+(source/'film/review.css').read_text()
    css += '''
html,body{height:auto;overflow:auto}main.panel{display:block;max-width:1100px;width:auto;margin:auto;overflow:visible}
a{color:var(--color-figure-accent);overflow-wrap:anywhere}nav a,.film{display:inline-flex;align-items:center;min-height:44px}
section{padding:16px 0;border-bottom:1px solid var(--color-border)}h2{font-size:20px}p{overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--color-border);vertical-align:top;overflow-wrap:anywhere}
small{display:block;color:var(--color-muted-text)}.note{white-space:pre-wrap}.metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
@media(max-width:767px){table,tbody,tr,td{display:block}thead{display:none}tr{padding:16px 0;border-bottom:1px solid var(--color-border)}td{border:0;padding:4px 0}td:before{content:attr(data-label) ': ';font-weight:650}}
'''
    page = ('<!doctype html><html lang="en"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>'+html.escape(title)+'</title><script>'
            'const theme=matchMedia("(prefers-color-scheme: dark)");'
            'const paint=()=>document.documentElement.dataset.theme=theme.matches?"dark":"light";'
            'paint();theme.addEventListener("change",paint);</script><style>'+css+'</style>'
            '<main class="panel"><h1>'+html.escape(title)+'</h1>'+body+'</main></html>')
    path = Path(config['live_data']).parent/(name+'.html')
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.html.tmp')
    temporary.write_text(page)
    temporary.replace(path)
    return path


def line_page(config):
    index = {r['id']: r for r in read_json(Path(config['live_data'])/'index.json', [])}
    # Only this allowlist is embedded. No recipe or prediction enters the list.
    rows = [{k: index[r['id']].get(k) for k in ('id', 'title', 'added', 'seconds')}
            for r in recipes(config) if r['id'] in index]
    rows.sort(key=lambda r: (r['added'] or '', r['id']), reverse=True)
    body = '<p>One film per skill. Open a film to watch, score it, and leave a note.</p>'
    for row in rows:
        identifier = html.escape(row['id'], quote=True)
        minutes, seconds = divmod(round(row['seconds'] or 0), 60)
        body += (f'<section data-film="{identifier}"><a class="film" href="review.html?id={identifier}&amp;list=line">'
                 f'{html.escape(row["title"] or row["id"])}</a><small>{minutes}:{seconds:02}</small></section>')
    body += '<script>const films='+json.dumps(rows, ensure_ascii=False).replace('<', '\\u003c')+';</script>'
    write_page(config, 'line', 'AMP lesson films', body)
    return len(rows)


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
    index = {r['id']: r for r in read_json(data/'index.json', [])}
    reviews, grades = read_json(data/'reviews.json', {}), read_json(data/'grades.json', {})
    predictions = read_json(Path(config['root'])/'predictions.json', {})
    rows = []
    for recipe in recipes(config):
        identifier = recipe['id']
        score, note = founder_score(identifier, index.get(identifier), reviews, grades)
        cost, tokens = recipe.get('cost', {}), recipe.get('tokens') or {}
        components = [tokens.get(k) for k in ('input_uncached', 'input_cached', 'cache_write', 'output')]
        prediction = predictions.get(identifier, {})
        row = {'id': identifier, 'title': recipe['skill']['title'], 'status': recipe['status'],
               'score': score, 'note': note, 'prediction': prediction.get('score'),
               'reason': prediction.get('reason', ''),
               'author': f'{recipe["model"]} / {recipe["effort"]}' if score is not None else 'Awaiting founder score',
               'dollars': cost.get('known_model_dollars') if cost.get('model_receipts_without_full_dollars') == 0 else None,
               'partial_dollars': cost.get('known_model_dollars'),
               'tokens': sum(components) if all(number(n) for n in components) and recipe.get('usage_complete') else None,
               'characters': cost.get('voice_input_characters'), 'credits': cost.get('voice_confirmed_credits'),
               'reserved': cost.get('voice_reserved_credits'),
               'minutes': recipe['total_seconds']/60 if number(recipe.get('total_seconds')) else None}
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
        if row['dollars'] is None and number(row['partial_dollars']):
            money = 'At least '+display(row['partial_dollars'], True)+' (incomplete)'
        cells['Usage'] = money+' model dollars; voice dollars unavailable'
        for key in ('tokens', 'characters', 'credits', 'reserved', 'minutes'):
            cells['Usage'] += '<small>'+display(row[key])+' '+METRICS[key].lower()+'</small>'
        body += '<tr>'+''.join(f'<td data-label="{label}">{value}</td>' for label, value in cells.items())+'</tr>'
    return write_page(config, 'board', 'Film production board', body+'</tbody></table>')
