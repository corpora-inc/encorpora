from copy import deepcopy
from pathlib import Path
import shutil
import subprocess

import pytest

from review_notes import mechanical_notes, moments, normalize, script_text
import review_tools
import providers
import line
from state import read_json
from test_line import setup


def payload(beats, figure=None):
    clock = .5
    times = []
    for beat in beats:
        words = []
        start = clock
        for text in beat['say'].split():
            words.append({'text': text, 'start': clock, 'end': clock+.8})
            clock += 1
        times.append({'start': start, 'end': clock-.2, 'words': words})
        clock += .5
    shot = {'beats': beats, **({'figure': figure} if figure else {})}
    return {'script': {'shots': [shot]}, 'timing': {'duration': clock+1, 'shots': [times]}, 'timing_source': 'estimated'}


def test_three_notes_and_clean_fixture():
    dirty = payload([
        {'say': 'Find four plus five.', 'do': [{'do': 'problem', 'text': 'Find $4 + 6$.'}]},
        {'say': 'Where is the base? Let us show it.', 'do': [{'do': 'clear'}, {'do': 'show', 'target': 'label', 'at': 'show'}]},
        {'say': 'Here is the next written step.', 'do': [{'do': 'write', 'tex': '4+5=9', 'at': 'step'}]},
    ], {'parts': [{'id': 'label', 'label': 'base'}]})
    notes = mechanical_notes(dirty)['notes']
    assert {n['kind'] for n in notes} == {'problem-wording', 'empty-board', 'early-reference'}
    assert all({'shot', 'beat', 'time'} <= n.keys() for n in notes)
    early = next(n for n in notes if n['kind'] == 'early-reference')
    assert early['time'] < early['appears']
    clean = payload([
        {'say': 'Find four plus five.', 'do': [{'do': 'problem', 'text': 'Find $4 + 5$.'}]},
        {'say': 'Where is the base?', 'do': [{'do': 'highlight', 'target': 'label'}]},
    ], {'parts': [{'id': 'label', 'label': 'base', 'start': True}]})
    assert mechanical_notes(clean)['notes'] == []
    assert 'scene parts' in mechanical_notes(clean)['note_limits'][1]


def test_problem_spans_next_beat_and_uncertain_math_is_reported():
    p = payload([{'say': 'Find two', 'do': [{'do': 'problem', 'text': 'Find $2 + 3$'}]}, {'say': 'plus three.'}])
    assert not any(n['kind'] == 'problem-wording' for n in mechanical_notes(p)['notes'])
    p['script']['shots'][0]['beats'][0]['do'][0]['text'] = r'Find $\sqrt{x}$'
    note = mechanical_notes(p)['notes'][0]
    assert note['screen'] == r'Find $\sqrt{x}$' and note['speech'] == 'Find two plus three.'
    assert normalize(r'$\frac{2}{3}$') == normalize('two over three')


def test_board_persists_between_beats_and_shots_and_pauses_are_not_speech():
    p = payload([{'say': 'One two three four five', 'do': [{'do': 'write', 'tex': '1'}]}, {'say': 'Six seven eight nine ten.'}])
    assert mechanical_notes(p)['notes'] == []
    p = payload([{'say': 'One two', 'pause': 3}, {'say': 'Three', 'do': [{'do': 'write', 'tex': '3'}]}])
    assert mechanical_notes(p)['notes'] == []


def test_lit_moments_include_every_occurrence_and_filmstrip_covers_duration():
    p = payload([{'speaker': 'teacher', 'say': 'Base then base then base.', 'do': [
        {'do': 'problem', 'text': 'Base'}, {'do': 'highlight', 'target': 'base', 'at': 'base', 'nth': 2},
        {'do': 'scene', 'at': 'base', 'nth': 3, 'actions': [{'do': 'emphasize', 'target': 'base'}]},
    ]}])
    marks = moments(p)
    assert [m['time'] for m in marks['lit']] == [3.05, 5.05]
    assert [m['time'] for m in marks['filmstrip']] == [0, 2, 4, 6]
    assert '1. Shot 1, beat 1' in script_text(p)
    assert 'teacher\nBase then base' in script_text(p) and 'On screen (problem): Base' in script_text(p)


def test_look_uses_current_voice_timing_and_updates_check_notes(setup, monkeypatch):
    config, args, _, _ = setup
    line.write_film(config, args)
    root, local, recipe, workspace = line.existing_film(config, args.film)
    script = read_json(workspace/'screenplay.json')
    p = payload(script['shots'][0]['beats']); p['script'] = script
    dry = workspace/'check-output'/args.film/'line-payload.json'
    providers.write_json(dry, p)
    voiced = root/'voiced'/args.film/'line-payload.json'
    voice = {**p, 'timing_source': 'voice'}
    providers.write_json(voiced, voice)
    assert review_tools.checked_payload(local, workspace)[0] == dry
    providers.write_json(root/'films'/args.film/'voice-run.json', {'exit_code': 0})
    assert review_tools.checked_payload(local, workspace)[0] == voiced
    def capture(command, *a):
        jobs = read_json(command[command.index('--items')+1])
        dest = Path(command[command.index('--out')+1])
        for job in jobs:
            for layout in ('wide', 'tall'):
                folder = dest/job['id']/('board-'+layout); folder.mkdir(parents=True)
                for n, _ in enumerate(job['times']):
                    (folder/f'{n:03}.jpg').write_bytes(b'fake')
        return {'exit_code': 0}
    monkeypatch.setattr(review_tools, '_run', capture)
    monkeypatch.setattr(review_tools, 'tile_sheets', lambda frames, marks, out, prefix, **kw: [str(out/(prefix+'-001.jpg'))] if frames else [])
    result = review_tools.look_worker(local)
    assert result['timing_source'] == 'voice'
    assert set(result['sheets']) == {'beats-wide', 'beats-tall', 'lit-wide', 'lit-tall', 'filmstrip-wide', 'filmstrip-tall'}
    assert read_json(workspace/'check.json')['notes'] == result['notes']
    voice['script'] = {'shots': []}; providers.write_json(voiced, voice)
    assert review_tools.checked_payload(local, workspace)[0] == dry


def test_sheet_singleton_and_multi_page_have_no_dropped_tiles(tmp_path):
    if not shutil.which('ffmpeg'):
        pytest.skip('FFmpeg unavailable')
    image = tmp_path/'frame.ppm'
    image.write_bytes(b'P6\n20 20\n255\n'+bytes([240, 230, 200])*400)
    marks = [{'time': n*2} for n in range(13)]
    files = review_tools.tile_sheets([image]*13, marks, tmp_path, 'fixture')
    assert len(files) == 2 and all(Path(f).stat().st_size > 100 for f in files)


def test_article_a_is_not_guessed_to_mean_point_a():
    p = payload([{'say': 'Where is a point? Show it here.', 'do': [{'do': 'show', 'target': 'label', 'at': 'Show'}]}],
                {'parts': [{'id': 'label', 'label': 'A'}]})
    assert not any(n['kind'] == 'early-reference' for n in mechanical_notes(p)['notes'])


def test_overview_of_empty_column_does_not_hide_empty_board_note():
    p = payload([{'say': 'One.', 'do': [{'do': 'write', 'tex': '1'}]},
                 {'say': 'Here is a long explanation with nothing written.', 'do': [{'do': 'clear'}, {'do': 'overview'}]}])
    assert any(n['kind'] == 'empty-board' for n in mechanical_notes(p)['notes'])
