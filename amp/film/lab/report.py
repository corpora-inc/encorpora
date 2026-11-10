"""Summarize private receipts without selecting a model winner."""
from __future__ import annotations
import argparse
import json
from pathlib import Path

from providers import now

ARM_ORDER = ['baseline', 'study-opus', 'study-sonnet', 'study-grok', 'write-opus',
             'write-fable', 'write-grok', 'write-sonnet', 'all-grok']
REVIEWERS = ['fable', 'opus', 'sonnet', 'astra', 'grok']


def read(path, default=None):
    return json.loads(path.read_text()) if path.exists() else default


def cell(value):
    return str(value).replace('|', '\\|').replace('\n', ' ').replace('\r', '')


def money(value):
    return f'${value:.6f}'


def build_report(root, review_url, status='running'):
    root = Path(root)
    mapping = read(root/'arms.json', {'pathways': [], 'assignments': [], 'seed': 'not selected'})
    rows = mapping['assignments']
    states = {row['id']: read(root/'films'/row['id']/'state.json', {}) for row in rows}
    receipts = [(p, read(p, {})) for p in (root/'runs').glob('**/*.json')]
    # Job metadata and provider batch manifests are outside runs/.
    receipts = [(p, r) for p, r in receipts if 'role' in r and 'provider' in r]
    preflights = [read(p, {}) for p in root.glob('claude-*-preflight.json')]
    known_api = sum(r.get('api_dollars') or 0 for _, r in receipts) + sum(r.get('total_cost_usd') or 0 for r in preflights)
    unknown_api = sum(r.get('transport') in ('api-cli', 'messages-api', 'messages-batch-api') and r.get('api_dollars') is None for _, r in receipts)
    nominal_grok = sum(r.get('reported_dollars') or 0 for _, r in receipts if r.get('provider') == 'grok')
    grok_probe = root/'grok-preflight.stdout'
    if grok_probe.exists():
        nominal_grok += read(grok_probe, {}).get('total_cost_usd', 0)
    quota = read(root/'voice-quota.json', {})
    voiced = sum(bool(s.get('voiced')) for s in states.values())
    exported = sum(bool(s.get('exported')) for s in states.values())
    out = [f'Grade the films on the [live review page]({review_url}), grouped by problem type. Approve or reject each version and leave a note. Grading even two types fully gives signal. The assignment key is private in `arms.json`.', '',
           f'Status: {status}. Updated {now()}.', '',
           f'Films voiced: **{voiced}**. Films exported: **{exported}**. Known Anthropic API charges at reported or published rates: **{money(known_api)}**. Anthropic API attempts with unavailable cost: **{unknown_api}**. ElevenLabs confirmed characters: **{quota.get("confirmed_characters", 0)}**; conservatively reserved characters, including uncertain calls: **{quota.get("reserved_characters", 0)}**.', '',
           f'Grok reported {money(nominal_grok)} usage cost through its CLI. This is kept separate from measured Anthropic API-key charges; CLI billing statements were not checked. Codex reports tokens without a dollar figure. Batch elapsed time includes queueing; per-request execution time is unavailable from the Batch API. Missing usage is not treated as zero.', '',
           '## Types and sampling', '', f'Seed: `{mapping["seed"]}`. Intended design: six pathways of nine different types, one type per arm per pathway, 54 distinct types. Comparisons are across neighboring types, not matched copies of one type. No winner is selected before founder grading.', '']
    for pathway in mapping['pathways']:
        out += [f'**{cell(pathway["id"])}: {cell(pathway.get("family", ""))}**', '',
                cell(pathway.get('reason', '')), '',
                ', '.join('`'+t+'`' for t in pathway['types']), '']
    out += ['The full eligible candidate pool, exclusions, random draws and arm assignment are in `arms.json` and `selection.json`. The review page contains no assignment metadata.', '',
            '## Production by arm', '',
            '| Arm | Types | Checked screenplays | Voiced | Exported | Terminal failures | API dollars per checked film | Grok reported dollars per checked film | Agent seconds per checked film | Unknown-cost attempts |',
            '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    for arm in ARM_ORDER:
        ids = {r['id'] for r in rows if r['arm'] == arm}
        ss = [states[i] for i in ids]
        runs = [r for p, r in receipts if p.parent.name in ids and r['role'] in ('study', 'screenplay')]
        produced = sum(bool(s.get('checked')) for s in ss)
        cost = sum(r.get('api_dollars') or 0 for r in runs)
        grok_cost = sum(r.get('reported_dollars') or 0 for r in runs if r.get('provider') == 'grok')
        seconds = sum(r.get('wall_seconds') or 0 for r in runs)
        unknown = sum(r.get('transport') == 'api-cli' and r.get('api_dollars') is None for r in runs)
        out.append('| '+' | '.join(map(str, [arm, len(ids), produced,
            sum(bool(s.get('voiced')) for s in ss), sum(bool(s.get('exported')) for s in ss),
            sum(s.get('status')=='failed' for s in ss), money(cost/produced) if produced else 'n/a',
            money(grok_cost/produced) if produced and any(r.get('provider')=='grok' for r in runs) else 'n/a',
            f'{seconds/produced:.1f}' if produced else 'n/a', unknown]))+' |')
    out += ['', 'Means include study and screenplay retries, divided by the number of checked screenplays. They exclude review and voice processing. A cost with unknown attempts is a lower bound. A checked screenplay is not a founder approval.', '',
            '## Usage by model and role', '',
            '| Model | Role | Attempts | Provider failures | Complete usage receipts | Mean wall seconds | API dollars | Grok reported dollars | Uncached input | Cached input | Cache writes | Output |',
            '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    for provider in REVIEWERS:
        for role in ('study', 'screenplay', 'review'):
            runs = [r for p, r in receipts if p.parent.name != 'preflight'
                    and r.get('provider')==provider and r.get('role')==role]
            if not runs:
                continue
            walls = [r['wall_seconds'] for r in runs if r.get('wall_seconds') is not None]
            token_sums = [sum((r.get('tokens') or {}).get(k) or 0 for r in runs)
                          for k in ('input_uncached', 'input_cached', 'cache_write', 'output')]
            values = [provider, role, len(runs), sum(r.get('status')=='failed' for r in runs),
                      sum(bool(r.get('usage_complete')) for r in runs),
                      f'{sum(walls)/len(walls):.1f}' if walls else 'unavailable',
                      money(sum(r.get('api_dollars') or 0 for r in runs)) if provider in ('fable', 'opus', 'sonnet') else 'n/a',
                      money(sum(r.get('reported_dollars') or 0 for r in runs)) if provider=='grok' else 'n/a',
                      *token_sums]
            out.append('| '+' | '.join(map(cell, values))+' |')
    out += ['', 'Token totals include only reported usage. An incomplete receipt makes the corresponding total a lower bound. Mean wall time uses only attempts with a measured duration; batch queue elapsed time is retained separately in each receipt. Artifact validation failures are recorded in the receipts even when the provider completed normally.', '',
            '## Failures and unvoiced films', '']
    failures = [(r, states[r['id']]) for r in rows if states[r['id']].get('status')=='failed']
    if failures:
        out += [f'- `{r["type"]}`: {cell(s.get("failure", "See state.json"))}' for r, s in failures]
    else:
        out.append('No terminal production failures recorded.')
    out += ['', 'Checked films left unvoiced:', '']
    unvoiced = [r for r in rows if states[r['id']].get('checked') and not states[r['id']].get('voiced')]
    out += [f'- `{r["id"]}`: {cell(states[r["id"]].get("voice_status", "pending"))}' for r in unvoiced] or ['None recorded.']
    out += ['', 'Voiced films awaiting export:', '']
    unexported = [r for r in rows if states[r['id']].get('voiced') and not states[r['id']].get('exported')]
    out += [f'- `{r["id"]}`: {cell(states[r["id"]].get("export_result", {}).get("error", "pending"))}'
            for r in unexported] or ['None recorded.']
    out += ['', 'Completed narration with a failed voiced-timing check:', '']
    timing_failed = [r for r in rows if states[r['id']].get('voiced')
                     and states[r['id']].get('voice_result', {}).get('check_passed') is False]
    out += [f'- `{r["id"]}`: {cell(states[r["id"]]["voice_result"].get("error", "See voice-run.json"))}'
            for r in timing_failed] or ['None recorded.']
    labels = read(root/'calibration-labels.json', {'records': []})['records']
    calibration_map = read(root/'calibration-map.json', {})
    out += ['', '## Reviewer calibration', '',
            f'Frozen founder grades: {len(labels)} films, {sum(r["grade"]["grade"]=="approved" for r in labels)} approved and {sum(r["grade"]["grade"]=="rejected" for r in labels)} rejected. Reviewers receive no founder grades or notes. The same reviewer prompt is used for calibration and new films.', '',
            '| Reviewer | Agree / valid verdicts | Missing or failed | Approved also approved | Rejected also rejected |',
            '| --- | ---: | ---: | ---: | ---: |']
    comparisons = []
    for provider in REVIEWERS:
        correct = valid = approved = rejected = 0
        for label in labels:
            cid = calibration_map.get(label['id'])
            verdict = read(root/'reviews'/str(cid)/(provider+'.json')) if cid else None
            if not verdict:
                continue
            founder = label['grade']['grade']=='approved'
            valid += 1
            agree = verdict['ship']==founder
            correct += agree
            approved += agree and founder
            rejected += agree and not founder
            comparisons.append((label, provider, verdict, agree))
        out.append(f'| {provider} | {correct}/{valid} | {len(labels)-valid} | {approved} | {rejected} |')
    out += ['', 'Verdict agreement does not establish agreement on the reason. The paired explanations below preserve both judgments; no automated semantic agreement score is claimed.', '',
            '| Film | Reviewer | Founder | Reviewer verdict / score | Agree | Founder note | Reviewer biggest problem and reason |',
            '| --- | --- | --- | --- | --- | --- | --- |']
    for label, provider, verdict, agree in comparisons:
        out.append('| '+' | '.join(map(cell, [label['id'], provider, label['grade']['grade'],
            f'{"yes" if verdict["ship"] else "no"} / {verdict["score"]}', 'yes' if agree else 'no',
            label['grade'].get('note') or '(No explanatory note.)',
            verdict['biggest_problem']+' '+verdict['reason']]))+' |')
    out += ['', '## Reviews of the new films', '',
            '| Type / blind ID | Reviewer | Ship | Score | Biggest problem | Reason |',
            '| --- | --- | --- | ---: | --- | --- |']
    for row in sorted(rows, key=lambda r: r['type']):
        for provider in REVIEWERS:
            verdict = read(root/'reviews'/row['id']/(provider+'.json'))
            if verdict:
                values = [row['id'], provider, 'yes' if verdict['ship'] else 'no', verdict['score'], verdict['biggest_problem'], verdict['reason']]
            else:
                values = [row['id'], provider, 'unavailable', 'n/a', '', 'No valid verdict recorded.']
            out.append('| '+' | '.join(map(cell, values))+' |')
    gaps = [json.loads(line) for line in (root/'coverage-gaps.jsonl').read_text().splitlines() if line.strip()] if (root/'coverage-gaps.jsonl').exists() else []
    out += ['', '## Coverage findings', '', f'{len(gaps)} study-reported gap records. Clause quotations were checked against the supplied standards; the audit conclusions have not been independently verified. Full clauses and seed-level evidence are in `coverage-gaps.jsonl`. Findings scoped to a type or written lesson are not claims about the entire catalog.', '',
            '| Standard | Scope | Type | Finding | Proposed action |', '| --- | --- | --- | --- | --- |']
    for gap in gaps:
        out.append('| '+' | '.join(cell(gap.get(k, '')) for k in ('standard', 'scope', 'type', 'gap', 'proposed_action'))+' |')
    out += ['', '## Kit and prompt findings', '']
    findings = read(root/'harness-findings.json', [])
    out += [f'- {cell(f["finding"])} Evidence: {cell(f["evidence"])} Change: {cell(f["change"])}' for f in findings] or ['No kit or prompt changes inferred from completed runs yet.']
    out += ['', '## Evidence and limits', '',
            '- `runs/`: per-attempt model, role, wall time, tokens, cached tokens, cost, raw responses and failures.',
            '- `calibration-source/` and `calibration-labels.json`: frozen exact live payloads, version checks and private founder labels.',
            '- `voice-ledger.jsonl` and `voice-quota.json`: every voice request and retry, exact voice IDs, quota checks and the 50,000-character reserve.',
            '- API prices: https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-11-10). CLI API costs use the provider-reported total. Messages API costs are calculated from returned usage and the published rate, not an invoice export.',
            '- Storyboards and timing do not measure audible voice quality. The founder watches the voiced exports.', '']
    (root/'RESULTS.md').write_text('\n'.join(out))
    return {'voiced': voiced, 'exported': exported, 'known_api_dollars': known_api,
            'unknown_api_attempts': unknown_api, 'elevenlabs_characters': quota.get('confirmed_characters', 0)}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--review-url', required=True)
    parser.add_argument('--status', default='running')
    args = parser.parse_args()
    print(json.dumps(build_report(args.root, args.review_url, args.status)))
