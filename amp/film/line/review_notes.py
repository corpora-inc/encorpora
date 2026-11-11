"""Deterministic review notes and capture moments from checked word timing.

These are observations, never kit failures. Text matching recognizes only simple
arithmetic and literal labels; it makes no claim about inferred figure meaning.
"""
import re

BOARD_TEXT = {'problem', 'write', 'text', 'term', 'watch', 'stack', 'answer', 'recap'}
LIMITS = [
    'Problem matching normalizes simple arithmetic, small integers and TeX wrappers; uncertain wording is shown side by side.',
    'Early references cover opening questions naming an exact built-figure label only; scene parts, pronouns and inferred meanings are not checked.',
    'Empty-board intervals follow board actions, not figure visibility; times are estimates when timing_source is estimated.',
]


def word(value):
    return re.sub(r'[^a-z0-9]', '', value.lower())


def normalize(value):
    value = value.lower()
    value = re.sub(r'\\(?:text|mathrm|mathbf|ca|cw|cg|cb|cv|cm)\{([^{}]*)\}', r' \1 ', value)
    value = re.sub(r'\\[dt]?frac\{([^{}]+)\}\{([^{}]+)\}', r' \1 over \2 ', value)
    for symbol, spoken in [(r'\times', ' times '), (r'\cdot', ' times '), (r'\div', ' divided by '),
                           ('+', ' plus '), ('−', ' minus '), ('-', ' minus '), ('=', ' equals ')]:
        value = value.replace(symbol, spoken)
    value = re.sub(r'\bis equal to\b', 'equals', value)
    numbers = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split()
    for n, name in enumerate(numbers):
        value = re.sub(r'\b'+name+r'\b', str(n), value)
    return re.findall(r'[a-z0-9]+', value)


def contains(haystack, needle):
    return bool(needle) and any(haystack[i:i+len(needle)] == needle for i in range(len(haystack)-len(needle)+1))


def beats(payload):
    for si, shot in enumerate(payload['script']['shots']):
        for bi, beat in enumerate(shot['beats']):
            yield si, bi, beat, payload['timing']['shots'][si][bi]


def actions(beat, timing):
    stagger = 0
    result = []
    for action in beat.get('do', []):
        if action.get('at'):
            hits = [w['start'] for w in timing['words'] if word(w['text']) == word(action['at'])]
            nth = action.get('nth', 1)
            if len(hits) < nth:
                raise ValueError('Action word is absent from checked timing: '+action['at'])
            at = hits[nth-1]
        else:
            at = timing['start'] + stagger
            stagger += .1
        result.append((at, action))
    return sorted(result, key=lambda row: row[0])


def moments(payload, lights=()):
    rows = list(beats(payload))
    end = []
    for i, (si, bi, beat, timing) in enumerate(rows):
        next_start = rows[i+1][3]['start'] if i+1 < len(rows) else payload['timing']['duration']
        at = max(timing['end'], min(timing['end']+.9, next_start-.05))
        if i+1 < len(rows) and rows[i+1][0] != si:
            at = max(timing['end'], min(at, next_start-.55))
        end.append({'shot': si+1, 'beat': bi+1, 'time': round(at, 3)})
    # The kit owns held-highlight timing; do not approximate it in Python.
    lit = [{'shot': rows[light['beat']][0]+1, 'beat': rows[light['beat']][1]+1,
            'time': light['t'], 'file': light['file'], 'word': light['word']} for light in lights]
    strip = [{'time': t} for t in range(0, int(payload['timing']['duration'])+1, 2)
             if t < payload['timing']['duration']]
    return {'beats': end, 'lit': lit, 'filmstrip': strip}


def mechanical_notes(payload):
    notes, events = [], []
    rows = list(beats(payload))
    for i, (si, bi, beat, timing) in enumerate(rows):
        shot = payload['script']['shots'][si]
        for at, action in actions(beat, timing):
            events.append((at, si+1, bi+1, action))
            if action['do'] == 'problem':
                spoken = beat['say'] + (' '+rows[i+1][2]['say'] if i+1 < len(rows) else '')
                commands = re.findall(r'\\([a-z]+)', action['text'])
                uncertain = bool(set(commands) - {'text', 'mathrm', 'mathbf', 'ca', 'cw', 'cg', 'cb', 'cv', 'cm', 'frac', 'dfrac', 'tfrac', 'times', 'cdot', 'div'}) or bool(re.search(r'[\^_<>]', action['text']))
                if uncertain or not contains(normalize(spoken), normalize(action['text'])):
                    notes.append({'kind': 'problem-wording', 'shot': si+1, 'beat': bi+1, 'time': round(at, 3),
                                  'screen': action['text'], 'speech': spoken,
                                  'note': 'Problem wording is not matched in this beat and the next; compare the two texts.'})
        # Only literal labels in explicit built figures can establish a reference
        # without guessing what a scene id means or what a pronoun refers to.
        opening = beat['say'].split('?')[0]
        if '?' not in beat['say'] or len(opening.split()) > 12:
            continue
        parts = shot.get('figure', {}).get('parts', [])
        previous = [(t, a) for psi, pbi, pb, pt in rows if psi == si and pbi <= bi for t, a in actions(pb, pt)]
        for part in parts:
            label = part.get('label', '')
            # Lowercase single-letter prose ("a") is ambiguous.
            if not re.fullmatch(r'[A-Z]|[A-Za-z]{2,}(?: [A-Za-z]+)*', label):
                continue
            if len(label) == 1 and label not in re.findall(r'[A-Za-z]+', opening):
                continue
            if not contains(normalize(opening), normalize(label)):
                continue
            words = timing['words']
            match = next((n for n in range(len(words)) if contains(normalize(' '.join(w['text'] for w in words[n:n+len(label.split())])), normalize(label))), None)
            if match is None:
                continue
            said = words[match]['start']
            visible = bool(part.get('start'))
            appears = None
            for at, action in sorted(previous, key=lambda r: r[0]):
                target = action.get('target', [])
                if part['id'] not in ([target] if isinstance(target, str) else target):
                    continue
                if action['do'] not in ('show', 'draw', 'hide'):
                    continue
                if at <= said:
                    visible = action['do'] != 'hide'
                elif action['do'] in ('show', 'draw') and at <= timing['end'] and appears is None:
                    appears = at
            if not visible and appears is not None:
                notes.append({'kind': 'early-reference', 'shot': si+1, 'beat': bi+1, 'time': round(said, 3),
                    'appears': round(appears, 3), 'part': part['id'], 'label': label,
                    'note': 'The opening question names this label before it is shown.'})
    # The board persists between shots; clear selects a new empty column.
    # Count speech time across beats, excluding pauses, until ink returns.
    visible, ever_visible, start = False, False, 0.0
    empty = []
    for at, si, bi, action in sorted(events, key=lambda e: e[0]):
        next_visible = visible
        if action['do'] == 'clear':
            next_visible = False
        elif action['do'] in BOARD_TEXT:
            next_visible = True
            ever_visible = True
        elif action['do'] == 'overview' and ever_visible and (action.get('columns') == 'all' or action.get('of')):
            next_visible = True
        if next_visible and not visible:
            empty.append((start, at))
        if visible and not next_visible:
            start = at
        visible = next_visible
    if not visible:
        empty.append((start, payload['timing']['duration']))
    for lo, hi in empty:
        segments = [(si, bi, max(lo, t['start']), min(hi, t['end'])) for si, bi, _, t in rows
                    if min(hi, t['end']) > max(lo, t['start'])]
        duration = sum(end-start for _, _, start, end in segments)
        if duration > 3:
            si, bi, at, _ = segments[0]
            notes.append({'kind': 'empty-board', 'shot': si+1, 'beat': bi+1, 'time': round(at, 3),
                          'until': round(hi, 3), 'speech_seconds': round(duration, 3),
                          'note': 'The whiteboard is empty for more than three seconds of speech.'})
    return {'notes': sorted(notes, key=lambda n: n['time']), 'note_limits': LIMITS}


def script_text(payload):
    output = []
    for n, (si, bi, beat, timing) in enumerate(beats(payload), 1):
        output.append(f"{n}. Shot {si+1}, beat {bi+1} · {timing['start']:.2f}s · {beat.get('speaker', 'narrator')}\n{beat['say']}")
        for _, action in actions(beat, timing):
            if action['do'] in BOARD_TEXT:
                text = ' | '.join(str(action[k]) for k in ('text', 'tex', 'word', 'meaning', 'note') if k in action)
                text += (' | '+ ' | '.join(action['choices'])) if 'choices' in action else ''
                text += (' | '+ ' | '.join(action['rows'])) if 'rows' in action else ''
                output.append('    On screen ('+action['do']+'): '+text.strip(' |'))
        parts = payload['script']['shots'][si].get('figure', {}).get('parts', [])
        for _, action in actions(beat, timing):
            if action['do'] in ('show', 'draw'):
                target = action['target']
                targets = [target] if isinstance(target, str) else target
                for part in parts:
                    if part['id'] in targets and part.get('label'):
                        output.append('    On screen (figure label): '+part['label'])
        output.append('')
    return '\n'.join(output)
