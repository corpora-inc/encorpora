"""AMP cinema pipeline: spec rules, the centered-text safe zone, filtergraph
builders, GPU batch planning, and the offline pages. No FFmpeg needed; the
end-to-end render is exercised by test/cinema.test.mjs."""
import copy
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cinema import gallery, graph, plan, spec, voice, youtube  # noqa: E402

EXAMPLES = Path(__file__).resolve().parents[1] / 'cinema' / 'examples'
ENV = {'AMP_MEDIA_ROOT': '/media', 'AMP_MUSIC_POOL': '/music'}
_env = patch.dict(os.environ, ENV)


def setUpModule():
    _env.start()


def tearDownModule():
    _env.stop()


def example():
    with patch.dict(os.environ, ENV):
        return spec.load(EXAMPLES / 'ad.json')


def raw():
    data = json.loads((EXAMPLES / 'ad.json').read_text())
    data['_base'] = EXAMPLES
    return data


def invalid(change):
    data = raw()
    change(data)
    with patch.dict(os.environ, ENV):
        spec.validate(data)


class SafeZone(unittest.TestCase):
    def centered(self, fmt, w_frac=0.4, h_frac=0.1, dx=0, dy=0):
        w, h = spec.size(fmt)
        bw, bh = w * w_frac, h * h_frac
        x1, y1 = (w - bw) / 2 + dx, (h - bh) / 2 + dy
        return (x1, y1, x1 + bw, y1 + bh), (w, h)

    def test_centered_text_passes_in_every_format(self):
        for fmt in spec.FORMATS:
            box, frame = self.centered(fmt)
            self.assertEqual(spec.text_box_problems(fmt, box, frame), [], fmt)

    def test_top_and_bottom_text_is_rejected(self):
        for fmt in spec.FORMATS:
            w, h = spec.size(fmt)
            top = (w * 0.3, h * 0.04, w * 0.7, h * 0.12)
            bottom = (w * 0.3, h * 0.84, w * 0.7, h * 0.94)
            self.assertTrue(any('top' in p for p in spec.text_box_problems(fmt, top, (w, h))), fmt)
            self.assertTrue(any('bottom' in p for p in spec.text_box_problems(fmt, bottom, (w, h))), fmt)

    def test_portrait_keeps_text_off_the_action_rail(self):
        box, frame = self.centered('portrait', w_frac=0.8)
        self.assertTrue(any('right' in p for p in spec.text_box_problems('portrait', box, frame)))

    def test_off_center_text_inside_the_safe_area_is_still_rejected(self):
        box, frame = self.centered('wide', w_frac=0.2, dx=300)
        problems = spec.text_box_problems('wide', box, frame)
        self.assertEqual(problems, [problems[0]])
        self.assertIn('horizontally centered', problems[0])
        box, frame = self.centered('portrait', dy=-250)
        self.assertTrue(any('vertically centered' in p for p in spec.text_box_problems('portrait', box, frame)))

    def test_text_area_is_inside_the_safe_area(self):
        for fmt in spec.FORMATS:
            frame = spec.size(fmt)
            aw, ah = spec.text_area(fmt, frame)
            box = ((frame[0] - aw) / 2, (frame[1] - ah) / 2, (frame[0] + aw) / 2, (frame[1] + ah) / 2)
            self.assertEqual(spec.text_box_problems(fmt, box, frame), [], fmt)

    def test_sizes(self):
        self.assertEqual(spec.size('portrait'), (1080, 1920))
        self.assertEqual(spec.size('feed'), (1080, 1350))
        self.assertEqual(spec.size('square'), (1080, 1080))
        self.assertEqual(spec.size('wide'), (1920, 1080))
        self.assertEqual(spec.size('portrait', master=True), (2160, 3840))
        self.assertEqual(spec.size('feed', divisor=4), (270, 336))


class Spec(unittest.TestCase):
    def test_example_is_valid_and_resolves_sources_per_format(self):
        s = example()
        self.assertEqual(s['duration'], 30)
        self.assertEqual(str(spec.shot_source(s, s['shots'][0], 'feed')),
                         '/media/2026-10-27/missing-piece-films/raw/mp2-machine-portrait-311.mp4')
        self.assertEqual(str(spec.shot_source(s, s['shots'][0], 'square')),
                         '/media/2026-10-27/missing-piece-films/raw/mp2-machine-wide-311.mp4')

    def test_source_map_prefers_format_then_orientation_then_default(self):
        s = example()
        shot = {'id': 'x', 'source': {'feed': 'f.mp4', 'portrait': 'p.mp4', 'default': 'd.mp4'}}
        self.assertEqual(spec.shot_source(s, shot, 'feed').name, 'f.mp4')
        self.assertEqual(spec.shot_source(s, shot, 'portrait').name, 'p.mp4')
        self.assertEqual(spec.shot_source(s, shot, 'wide').name, 'd.mp4')

    def test_unset_media_root_is_an_error_not_a_literal_path(self):
        with patch.dict(os.environ, {}, clear=True):
            s = spec.validate(raw())
            with self.assertRaisesRegex(spec.SpecError, 'AMP_MEDIA_ROOT'):
                spec.shot_source(s, s['shots'][0], 'wide')

    def test_timeline_matches_the_missing_piece_receipts(self):
        # Offsets and render lengths recorded by the 2026-10-27 missing-piece render.
        t = spec.timeline(example())
        self.assertEqual([x['outputStart'] for x in t[1:]], [3.875, 9.575, 14.575, 19.375, 24.275])
        self.assertEqual([x['renderDuration'] for x in t], [4.125, 5.95, 5.25, 5.05, 5.15, 5.725])

    def test_rejections(self):
        cases = {
            'position': lambda d: d['cards'][0].update(position='top'),
            'too long': lambda d: d['cards'][0].update(text='one two three four five six seven eight nine ten eleven'),
            'end card': lambda d: d['cards'][0].update(end=23.5),
            'sum to': lambda d: d['shots'][0].update(duration=3.0),
            'half an adjacent': lambda d: (d['shots'][0].update(duration=3.0), d['shots'][1].update(duration=6.7),
                                           d['shots'][0]['transition'].update(duration=1.9)),
            'last shot': lambda d: d['shots'][-1].update(transition={'type': 'fade', 'duration': 0.2}),
            'retime': lambda d: d['shots'][1].update(out=0.5),
            'rights': lambda d: d['music'].pop('rights'),
            'voice, music': lambda d: (d.pop('voice'), d.pop('music')),
            'endCard': lambda d: d.pop('endCard'),
            'overlap': lambda d: d['voice']['segments'][1].update(at=4.0),
            'slug': lambda d: d.update(id='Bad Id'),
            'fps': lambda d: d.update(fps=60),
            'formats': lambda d: d.update(formats=['tiktok']),
        }
        for message, change in cases.items():
            with self.subTest(message), self.assertRaisesRegex(spec.SpecError, message):
                invalid(change)


class Graph(unittest.TestCase):
    def setUp(self):
        self.s = example()
        self.sources = [f'/clips/{s["id"]}.mp4' for s in self.s['shots']]

    def video(self, **kw):
        return graph.video_command(self.s, (1080, 1920), self.sources, [('/c0.png', 0.15, 2.9)], '/end.png',
                                   '/mix.m4a', '/out.mp4', **kw)

    def test_video_filtergraph(self):
        args = self.video()
        fc = args[args.index('-filter_complex') + 1]
        for offset in ['3.875', '9.575', '14.575', '19.375', '24.275']:
            self.assertIn(f'xfade=transition=fade:duration=0.25:offset={offset}', fc)
        self.assertIn('scale=1080:1920:force_original_aspect_ratio=increase', fc)
        self.assertIn('setpts=(PTS-STARTPTS)*1,', fc)  # retime: false holds the clip's own speed
        self.assertIn('overlay=0:0:enable=between(t\\,0.15\\,2.9)', fc)
        self.assertIn('overlay=0:0:enable=gte(t\\,23)', fc)
        self.assertEqual(args[args.index('-map') + 3], '8:a')  # 6 shots + 1 card + end card -> audio is input 8
        self.assertEqual(args[-1], '/out.mp4')
        self.assertIn('libx264', args)
        self.assertIn('h264_videotoolbox', self.video(encoder='videotoolbox'))

    def test_contain_fit_letterboxes_product_footage(self):
        self.s['shots'][2]['fit'] = 'contain'
        fc = self.video()[self.video().index('-filter_complex') + 1]
        self.assertIn('force_original_aspect_ratio=decrease', fc)
        self.assertIn(f'color={graph.BACKGROUND}', fc)

    def test_premix_ducks_music_under_voice_and_caps_length(self):
        args = graph.premix_command(self.s, '/v.mp3', '/m.mp3', [], 3.0, -4.0, '/pre.wav', 16.0)
        fc = args[args.index('-filter_complex') + 1]
        self.assertIn('[bed][key]sidechaincompress', fc)
        self.assertIn('concat=n=', fc)
        self.assertNotIn('apad', fc)
        self.assertEqual(args[args.index('-t', args.index('-filter_complex')) + 1], '30')
        self.assertIn('pcm_f32le', args)
        for seg in self.s['voice']['segments']:
            self.assertIn(f'atrim=start={seg["from"]:.6g}:end={seg["to"]:.6g}', fc)

    def test_music_only_has_no_ducking(self):
        s = copy.deepcopy(self.s)
        s['voice'] = None
        fc = graph.premix_command(s, None, '/m.mp3', [], 0, -2, '/pre.wav')
        self.assertNotIn('sidechaincompress', ';'.join(fc))

    def test_second_loudnorm_pass_targets_social_loudness(self):
        measured = {'input_i': '-20', 'input_tp': '-3', 'input_lra': '7', 'input_thresh': '-30', 'target_offset': '0.1'}
        af = graph.loudnorm_command('/pre.wav', measured, '/mix.m4a')
        joined = ' '.join(af)
        self.assertIn('I=-14.0', joined)
        self.assertIn('measured_I=-20', joined)
        self.assertIn('linear=true', joined)


class Plan(unittest.TestCase):
    def shotlist(self):
        return json.loads((EXAMPLES / 'shotlist.json').read_text())

    def test_round_robin_plan(self):
        jobs, prompts, env = plan.build(self.shotlist(), '/gpu/amp-cinema', '/gpu/env/bin/python', '/gpu/outputs')
        # click-faceon: 4 seeds x 2 framings; heaven: 2 seeds x 2 framings.
        self.assertEqual(len(jobs), 12)
        self.assertEqual([j['name'] for j in jobs[:4]], ['mp4-click-faceon-portrait-101', 'mp4-click-faceon-wide-101',
                                                         'mp4-heaven-portrait-101', 'mp4-heaven-wide-101'])
        job = jobs[0]
        self.assertEqual(job['requiredFiles'], ['/gpu/amp-cinema/missing-piece-v4/click-faceon-portrait.txt'])
        self.assertEqual(job['command'][:2], ['/gpu/env/bin/python', '/gpu/amp-cinema/ltx-benchmark.py'])
        self.assertEqual(job['command'][job['command'].index('--width') + 1], '768')
        self.assertEqual(job['meta'], {'shot': 'click-faceon', 'framing': 'portrait', 'seed': 101})
        text = prompts['click-faceon-portrait.txt']
        self.assertTrue(text.startswith('Vertical 9:16'))
        self.assertIn('rigid solid disc', text)
        self.assertTrue(text.endswith('No people.'))
        self.assertEqual(env['BATCH'], 'missing-piece-v4')
        self.assertEqual(env['MAX_TEMP_C'], 95)

    def test_rejects_bad_shotlists(self):
        for change in [lambda d: d.update(batch='Bad'), lambda d: d.update(seeds=[]),
                       lambda d: d['model'].update(frames=120), lambda d: d.update(framings=['square']),
                       lambda d: d['shots'].append(dict(d['shots'][0]))]:
            data = self.shotlist()
            change(data)
            with self.assertRaises(spec.SpecError):
                plan.build(data, '/r', '/p', '/o')

    def test_write_emits_a_runnable_batch_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / 'batch'
            plan.write(EXAMPLES / 'shotlist.json', out, '/gpu/amp cinema', '/py', '/out')
            names = sorted(p.name for p in out.iterdir())
            self.assertIn('supervise.sh', names)
            self.assertIn('plan.json', names)
            self.assertIn("AMP_SPARK_ROOT='/gpu/amp cinema'", (out / 'batch.env').read_text())
            with self.assertRaisesRegex(spec.SpecError, 'already holds a plan'):
                plan.write(EXAMPLES / 'shotlist.json', out, '/r', '/p', '/o')


FAKE_RUNNER = """import argparse, json, sys
from pathlib import Path
p = argparse.ArgumentParser()
for a in ['plan', 'outputs', 'models', 'status', 'attempts', 'lock']:
    p.add_argument('--' + a)
a, _ = p.parse_known_args()
status = json.loads(Path(a.status).read_text()) if Path(a.status).exists() else {}
for job in json.loads(Path(a.plan).read_text()):
    if status.get(job['name'], {}).get('status') == 'complete':
        continue
    ok = 'bad' not in job['name'] and 'defer' not in job['name']
    status[job['name']] = {'status': 'complete' if ok else ('deferred' if 'defer' in job['name'] else 'failed')}
    Path(a.status).write_text(json.dumps(status))
    if not ok:
        Path(a.attempts, job['name']).mkdir(parents=True, exist_ok=True)
        sys.exit(1)
"""


class Supervisor(unittest.TestCase):
    def test_quarantines_a_failed_job_and_finishes_the_rest(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'gpu'
            (root / 'guard-v1').mkdir(parents=True)
            (root / 'guard-v1' / 'batch.py').write_text(FAKE_RUNNER)
            data = json.loads((EXAMPLES / 'shotlist.json').read_text())
            data['shots'][1]['id'] = 'bad-shot'
            shotlist = Path(tmp) / 'shotlist.json'
            shotlist.write_text(json.dumps(data))
            batch = root / data['batch']
            jobs = plan.write(shotlist, batch, str(root), '/py', str(root / 'outputs'))
            r = subprocess.run(['bash', str(batch / 'supervise.sh'), str(batch)], capture_output=True, text=True,
                               env={**os.environ, 'QUARANTINE_PAUSE': '0'}, timeout=60)
            self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
            self.assertIn('ALL DONE', r.stdout)
            bad = [j['name'] for j in jobs if 'bad' in j['name']]
            self.assertEqual(r.stdout.count('QUARANTINE'), len(bad))
            remaining = json.loads((batch / 'active-plan.json').read_text())
            self.assertEqual(len(remaining), len(jobs) - len(bad))
            self.assertTrue((root / 'guard-runs' / f'{data["batch"]}-failed' / bad[0]).is_dir())
            self.assertEqual(len(json.loads((batch / 'plan.json').read_text())), len(jobs))  # original kept


    def test_a_host_side_stop_is_not_quarantined(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'gpu'
            (root / 'guard-v1').mkdir(parents=True)
            (root / 'guard-v1' / 'batch.py').write_text(FAKE_RUNNER)
            data = json.loads((EXAMPLES / 'shotlist.json').read_text())
            data['shots'][1]['id'] = 'defer-me'
            shotlist = Path(tmp) / 'shotlist.json'
            shotlist.write_text(json.dumps(data))
            batch = root / data['batch']
            jobs = plan.write(shotlist, batch, str(root), '/py', str(root / 'outputs'))
            r = subprocess.run(['bash', str(batch / 'supervise.sh'), str(batch)], capture_output=True, text=True,
                               env={**os.environ, 'QUARANTINE_PAUSE': '0'}, timeout=60)
            self.assertEqual(r.returncode, 1)
            self.assertIn('=deferred', r.stdout)
            self.assertNotIn('QUARANTINE', r.stdout)
            self.assertEqual(len(json.loads((batch / 'active-plan.json').read_text())), len(jobs))


class Pages(unittest.TestCase):
    def test_gallery_groups_by_shot_and_escapes(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / 'clips').mkdir()
            jobs, _, _ = plan.build(json.loads((EXAMPLES / 'shotlist.json').read_text()), '/r', '/p', '/o')
            (d / 'plan.json').write_text(json.dumps(jobs))
            for j in jobs[:3]:
                (d / 'clips' / f'{j["name"]}.mp4').write_bytes(b'')
            (d / 'clips' / 'unrelated-<x>.mp4').write_bytes(b'')
            page = gallery.clips(d).read_text()
            self.assertIn('click-faceon <small>2</small>', page)
            self.assertIn('heaven <small>1</small>', page)
            self.assertNotIn('unrelated', page)
            self.assertIn('3 of 12 clips', page)


class Voice(unittest.TestCase):
    def test_transcript_check_ignores_case_and_punctuation(self):
        self.assertTrue(voice.transcript_matches('Try Amp free.', 'try AMP free'))
        self.assertFalse(voice.transcript_matches('Try Amp free.', 'Try Amp for free'))

    def test_rest_body_keeps_style_neutral_and_never_holds_a_key(self):
        body = voice.request_body({'script': 'Hi.', 'model': 'm'})
        self.assertEqual(body['voice_settings']['style'], 0.0)
        self.assertNotIn('key', json.dumps(body).lower())

    def test_generate_requires_key_from_environment(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaisesRegex(spec.SpecError, 'ELEVENLABS_API_KEY'):
            voice.generate(example())


class YouTube(unittest.TestCase):
    def test_uploads_are_private_and_disclose_generated_media(self):
        body = youtube.metadata('A title', 'Desc')
        self.assertEqual(body['status']['privacyStatus'], 'private')
        self.assertTrue(body['status']['containsSyntheticMedia'])
        self.assertFalse(body['status']['selfDeclaredMadeForKids'])
        with self.assertRaises(spec.SpecError):
            youtube.metadata('x' * 101, '')

    def test_upload_refuses_without_channel_guard(self):
        with tempfile.NamedTemporaryFile(suffix='.mp4') as f, patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(spec.SpecError, 'AMP_YOUTUBE_CHANNEL_ID'):
                youtube.upload(f.name, 'Title', '')


if __name__ == '__main__':
    unittest.main()
