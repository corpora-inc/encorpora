"""Independent clock-skill review: the time a clock problem reads or asks for
must fit the skill it is filed under, and a choice key must name the clock or
time that actually shows it. Reads only the public payload (skillId, prompt,
figure, response) and the exported answer key, never generator code.

  clock-half-hours    minute 0 or 30
  clock-five-minutes  minute a multiple of 5
  clock-minutes       any minute 0-59

The time under test is the single drawn clock, and every H:MM time the prompt
names. Distractor clocks in a several-clock choice may show any time.

Standalone: python3 scripts/clock_skill_oracle.py [cases.jsonl]  (stdin when
no file) reviews every clock-skill case and lists each failure."""
import copy
import json
import re
import sys
from collections import Counter

MINUTES = {
    'clock-half-hours': frozenset({0, 30}),
    'clock-five-minutes': frozenset(range(0, 60, 5)),
    'clock-minutes': frozenset(range(60)),
}
NAMED_TIME = re.compile(r'(?<![\d:])(\d{1,2}):(\d\d)(?![\d:])')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def handles(public):
    return public.get('skillId') in MINUTES


def drawn_clocks(public):
    figure = public.get('figure') or {}
    if figure.get('kind') == 'analog-clocks':
        clocks = figure['clocks']
    elif figure.get('kind') == 'clock':
        clocks = [figure]
    else:
        return []
    for clock in clocks:
        require(isinstance(clock['hour'], int) and isinstance(clock['minute'], int)
                and 1 <= clock['hour'] <= 12 and 0 <= clock['minute'] < 60,
                f"Invalid clock {clock['hour']}:{clock['minute']}")
    return clocks


def target_times(public):
    """The times the problem reads or asks for, as (hour, minute) pairs."""
    clocks = drawn_clocks(public)
    times = [(int(h), int(m)) for h, m in NAMED_TIME.findall(public['prompt'])]
    for hour, minute in times:
        require(1 <= hour <= 12 and 0 <= minute < 60, f'Invalid named time {hour}:{minute:02d}')
    if len(clocks) == 1:
        times.append((clocks[0]['hour'], clocks[0]['minute']))
    require(times, 'A clock-skill problem must draw one clock or name a time')
    return clocks, sorted(set(times))


def written(hour, minute):
    return f'{hour}:{minute:02d}'


def plain(label):
    return label.replace('$', '').strip()


def keyed_label(problem):
    response = problem['public']['response']
    labels = {o['id']: o['label'] for o in response['options']}
    require(len(set(labels.values())) == len(labels), 'Duplicate option labels')
    require(problem['answer'] in labels, f"Key {problem['answer']!r} is not an option")
    return plain(labels[problem['answer']])


def review_key(problem, clocks, times):
    public = problem['public']
    if public['response']['kind'] != 'choice':
        return
    label = keyed_label(problem)
    if len(clocks) > 1:
        # "Which clock shows H:MM?": the key names the one clock showing it.
        require(len(times) == 1, 'A several-clock choice names exactly one time')
        hits = [c.get('label') for c in clocks if (c['hour'], c['minute']) == times[0]]
        require(len(hits) == 1 and hits[0], f'Exactly one labelled clock must show {written(*times[0])}')
        require(label in (hits[0], f'Clock {hits[0]}'),
                f'Key {label!r} is not clock {hits[0]}, which shows {written(*times[0])}')
        return
    require(len(clocks) == 1, 'A choice about a named time needs a drawn clock')
    hour, minute = clocks[0]['hour'], clocks[0]['minute']
    found = re.match(r'(\d{1,2}):(\d\d)(?:\s|$)', label)
    if found:
        require((int(found[1]), int(found[2])) == (hour, minute),
                f'Key {label!r} is not the clock time {written(hour, minute)}')
    elif re.fullmatch(r'\d{1,2}', label):
        asks_minutes = 'minute' in public['prompt']
        require(int(label) == (minute if asks_minutes else hour),
                f'Key {label!r} is not the clock {"minute" if asks_minutes else "hour"}')
    else:
        raise ValueError(f'Unrecognized clock choice key {label!r}')


def review_problem(problem):
    """Raise ValueError when the clock time does not fit the skill or the key is wrong."""
    public = problem['public']
    if not handles(public):
        return None
    clocks, times = target_times(public)
    allowed = MINUTES[public['skillId']]
    for hour, minute in times:
        require(minute in allowed,
                f"{public['skillId']} problem reads {written(hour, minute)}: {public['prompt']!r}")
    review_key(problem, clocks, times)
    return times


def review_stream(lines):
    """Review every clock-skill case; return counts and every failure line."""
    counts, other_clocks, failures = Counter(), Counter(), []
    for line in lines:
        if not line.strip():
            continue
        record = json.loads(line)
        if record.get('kind') != 'case':
            continue
        problem = record['problem']
        public = problem['public']
        if not handles(public):
            if drawn_clocks(public) or public['skillId'].startswith('clock-'):
                other_clocks[(public['skillId'], public['templateId'])] += 1
            continue
        try:
            review_problem(problem)
            counts[(public['skillId'], public['templateId'])] += 1
        except (ValueError, KeyError, TypeError) as error:
            failures.append(f"{public['templateId']}/{public['seed']} [{public['skillId']}]: {error}")
    return counts, other_clocks, failures


def self_test():
    def problem(skill, prompt, figure, labels, key, template='fixture'):
        public = {'templateId': template, 'seed': 'fixture', 'skillId': skill, 'prompt': prompt, 'figure': figure,
                  'response': {'kind': 'choice', 'options': [{'id': f'o{i}', 'label': l} for i, l in enumerate(labels)]}}
        return {'public': public, 'answer': f'o{key}'}

    one = lambda h, m: {'kind': 'analog-clocks', 'clocks': [{'hour': h, 'minute': m}]}
    three = lambda *times: {'kind': 'analog-clocks', 'clocks': [
        {'hour': h, 'minute': m, 'label': 'ABC'[i]} for i, (h, m) in enumerate(times)]}
    passing = [
        problem('clock-five-minutes', 'Which clock shows 4:35?', three((7, 20), (4, 35), (4, 7)), ['Clock A', 'Clock B', 'Clock C'], 1),
        problem('clock-five-minutes', 'What time does the clock show?', one(4, 35), ['5:35', '4:35', '4:07'], 1),
        problem('clock-half-hours', 'What time does the clock show?', one(12, 30), ['12:30', '6:00'], 0),
        problem('clock-minutes', 'Which clock shows 4:01?', three((4, 1), (1, 20), (4, 5)), ['A', 'B', 'C'], 0),
        problem('clock-minutes', 'How many minutes after the hour does the clock show?', one(7, 36), ['36', '37', '7'], 0),
    ]
    for case in passing:
        review_problem(case)
    bug = problem('clock-five-minutes', 'Which clock shows 4:01?', three((4, 1), (1, 20), (4, 5)), ['A', 'B', 'C'], 0)
    rejected = [
        (bug, 'five-minute skill asks for 4:01'),
        (problem('clock-five-minutes', 'What time does the clock show?', one(4, 37), ['4:37', '4:35'], 0), 'five-minute skill draws 4:37'),
        (problem('clock-half-hours', 'What time does the clock show?', one(4, 15), ['4:15', '4:30'], 0), 'half-hour skill draws 4:15'),
    ]
    wrong_key = copy.deepcopy(passing[0])
    wrong_key['answer'] = 'o2'
    rejected.append((wrong_key, 'key names a distractor clock'))
    wrong_time = copy.deepcopy(passing[1])
    wrong_time['answer'] = 'o0'
    rejected.append((wrong_time, 'key names the wrong digital time'))
    moved = copy.deepcopy(passing[0])
    moved['public']['figure']['clocks'][0].update(hour=4, minute=35)
    rejected.append((moved, 'two clocks show the asked time'))
    for case, why in rejected:
        try:
            review_problem(case)
        except ValueError:
            continue
        raise ValueError(f'Clock-skill oracle accepted a bad case: {why}')
    _, _, failures = review_stream([json.dumps({'kind': 'case', 'problem': bug})])
    require(len(failures) == 1 and '4:01' in failures[0], 'Stream review must report the 4:01 case')
    return {'fixtures': len(passing), 'rejected': len(rejected)}


if __name__ == '__main__':
    print('Clock-skill self-test: ' + json.dumps(self_test()))
    source = open(sys.argv[1]) if len(sys.argv) > 1 else sys.stdin
    counts, other_clocks, failures = review_stream(source)
    for (skill, template), n in sorted(counts.items()):
        print(f'checked {n:4d}  {skill:20s} {template}')
    for (skill, template), n in sorted(other_clocks.items()):
        print(f'not ruled {n:4d}  {skill:20s} {template}')
    for failure in failures:
        print(f'FAIL {failure}')
    print(json.dumps({'checked': sum(counts.values()), 'failures': len(failures)}))
    sys.exit(1 if failures else 0)
