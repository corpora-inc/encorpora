"""Production safety and recovery checks; no providers or media processes run."""
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

import prod
from prod_report import build_status, spending
from providers import run_agent, write_json
from state import read_json


class ProductionFixtures(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.config = {'root': str(self.root), 'workspace_root': str(self.root/'work'),
                       'worktree': str(self.root/'checkout'), 'agents': 2,
                       'review_url': 'http://localhost/live/prod.html'}

    def row(self, name='example', writer='sonnet'):
        return {'id': name+'--aa', 'type': name, 'grade': 'K',
                'study': 'sonnet', 'screenplay': writer, 'family_path': 'family.md'}

    def state(self, row, **value):
        write_json(self.root/'films'/row['id']/'state.json', value)


class SpendAndPauseTests(ProductionFixtures):
    def test_only_this_modes_anthropic_receipts_count_toward_start_threshold(self):
        write_json(self.root/'runs/first/study.json',
                   {'transport': 'api-cli', 'status': 'succeeded', 'api_dollars': 249})
        write_json(self.root/'runs/second/writer.json',
                   {'transport': 'account-cli', 'status': 'succeeded', 'reported_dollars': 1000})
        self.assertIsNone(prod.stop_reason(self.config))
        write_json(self.root/'runs/third/review.json',
                   {'transport': 'messages-batch-api', 'status': 'succeeded', 'api_dollars': 1})
        self.assertIn('$250', prod.stop_reason(self.config))
        self.assertEqual(spending(self.root)['known_dollars'], 250)

    def test_partial_costs_are_lower_bounds_and_unknowns_are_not_zero(self):
        write_json(self.root/'runs/first/study.json', {'transport': 'api-cli',
                   'status': 'failed', 'api_dollars': None, 'partial_api_dollars': 2.25})
        write_json(self.root/'runs/second/review.json',
                   {'transport': 'messages-api', 'status': 'failed', 'api_dollars': None})
        write_json(self.root/'runs/third/review.json',
                   {'transport': 'messages-api', 'status': 'running', 'api_dollars': None})
        result = spending(self.root)
        self.assertEqual(result['known_dollars'], 2.25)
        self.assertEqual(result['api_dollars'], 0)
        self.assertEqual(result['incomplete_costs'], 2)
        self.assertAlmostEqual(result['admission_dollars'],50)
        self.assertAlmostEqual(result['unconfirmed_holds'],47.75)
        self.assertIsNone(prod.stop_reason(self.config))

    def test_pause_finishes_running_slots_and_never_starts_queued_films(self):
        rows = [self.row(name) for name in ('first', 'second', 'third', 'fourth')]
        rendezvous = threading.Barrier(2)
        lock = threading.Lock()
        started, finished = [], []

        def produce(config, row, *_):
            with lock:
                started.append(row['id'])
            rendezvous.wait(timeout=5)
            (self.root/'PAUSE').touch()
            return row

        def post(config, row, *_):
            finished.append(row['id'])

        with patch('prod.produce_one', side_effect=produce), \
                patch('prod.postprocess', side_effect=post), \
                patch('prod.build_status'), patch('prod.deferred_reviews'):
            reason = prod.run_grade(self.config, rows, 'plan', {})
        self.assertIn('PAUSE', reason)
        self.assertCountEqual(started, [r['id'] for r in rows[:2]])
        self.assertCountEqual(finished, started)

    def test_pause_does_not_skip_prestarted_films_after_an_unstarted_row(self):
        fresh, started = self.row('fresh'), self.row('started')
        self.state(started, started_at='2026-01-01T00:00:00Z', status='writing')
        (self.root/'PAUSE').touch()
        with patch('prod.produce_one', side_effect=lambda config, row, *_: row) as produce, \
                patch('prod.postprocess'), patch('prod.build_status'), patch('prod.deferred_reviews'):
            prod.run_grade(self.config, [fresh, started], 'plan', {})
        self.assertEqual([c.args[1]['id'] for c in produce.call_args_list], [started['id']])


class RevisionAndVoiceTests(ProductionFixtures):
    def test_resuming_after_revision_does_not_repeat_initial_review_or_writer(self):
        row = self.row()
        initial = {'ship': False, 'score': 4, 'reason': 'Missing a necessary picture.'}
        state = {'written': True, 'revised': True, 'verdicts': [initial]}
        with patch('prod.stickler', return_value={'ship': True}) as review, \
                patch('prod.checked_write') as writer:
            prod.finish_review(self.config, row, state, self.root/'work', {})
        writer.assert_not_called()
        self.assertEqual(review.call_count, 1)
        self.assertEqual(review.call_args.kwargs['edition'], 2)
        self.assertTrue(state['reviewed'])

    def test_rejected_revision_is_recorded_then_permitted_to_voice(self):
        row = self.row()
        workspace = self.root/'work'
        state = {'written': True, 'writer': 'grok', 'workspace': str(workspace)}
        seen = []

        def review(config, row, state, workspace, secrets, *, edition=1, **kwargs):
            verdict = {'ship': False, 'score': 4, 'reason': 'A concrete teaching fault.'}
            state.setdefault('verdicts', []).append(verdict)
            seen.append(('review', edition))
            return verdict

        def revise(config, row, state, workspace, secrets, *, revision=False, **kwargs):
            self.assertTrue(revision)
            self.assertEqual(state['writer'], 'grok')
            state['revised'] = True
            seen.append(('revision', 1))

        with patch('prod.stickler', side_effect=review), patch('prod.checked_write', side_effect=revise):
            prod.finish_review(self.config, row, state, workspace, {})
        self.assertEqual(seen, [('review', 1), ('revision', 1), ('review', 2)])
        self.assertTrue(state['reviewed'])
        self.assertEqual(len(state['verdicts']), 2)
        self.assertFalse(state['verdicts'][-1]['ship'])

    def test_passing_first_review_does_not_revise(self):
        row = self.row()
        state = {'written': True}
        with patch('prod.stickler', return_value={'ship': True}) as review, patch('prod.checked_write') as writer:
            prod.finish_review(self.config, row, state, self.root/'work', {})
        self.assertTrue(state['reviewed'])
        self.assertEqual(review.call_count, 1)
        writer.assert_not_called()

    def test_unreviewed_film_cannot_consume_voice_quota(self):
        row = self.row()
        self.state(row, written=True, workspace=str(self.root/'work'))
        with patch('prod.completed_voice') as recover, patch('prod.voice_film') as voice, \
                patch('prod_runtime.export_film') as export:
            prod.postprocess(self.config, row, {})
        recover.assert_not_called()
        voice.assert_not_called()
        export.assert_not_called()

    def test_voice_reserve_defers_without_spending_or_consuming_attempt(self):
        row = self.row()
        self.state(row, written=True, reviewed=True, workspace=str(self.root/'work'))
        write_json(self.root/'voice-quota.json', {'reserve_stopped': True})
        with patch('prod.completed_voice', return_value=None), patch('prod.voice_film') as voice:
            prod.postprocess(self.config, row, {})
        voice.assert_not_called()
        state = read_json(self.root/'films'/row['id']/'state.json')
        self.assertEqual(state.get('voice_attempts', 0), 0)
        self.assertIn('reserve', state['voice_status'])

    def test_interrupted_second_voice_attempt_does_not_get_a_third_attempt(self):
        row = self.row()
        self.state(row, reviewed=True, workspace=str(self.root/'work'), voice_attempts=2)
        with patch('prod.completed_voice', return_value=None), patch('prod.voice_film') as voice:
            prod.postprocess(self.config, row, {})
        voice.assert_not_called()
        self.assertTrue(read_json(self.root/'films'/row['id']/'state.json')['voice_terminal'])

    def test_saved_audio_with_failed_voiced_timing_check_cannot_export(self):
        row = self.row()
        self.state(row, reviewed=True, workspace=str(self.root/'work'))
        write_json(self.root/'films'/row['id']/'voice-run.json', {'exit_code': 1})
        with patch('prod.completed_voice', return_value={'voiced': True}), \
                patch('prod.voice_film', return_value={'voiced': True, 'reused_completed_voice': True}), \
                patch('prod_runtime.export_film') as export:
            prod.postprocess(self.config, row, {})
        export.assert_not_called()
        saved = read_json(self.root/'films'/row['id']/'state.json')
        self.assertFalse(saved['voiced'])
        self.assertIn('passing kit check', saved['voice_status'])

    def test_legacy_acoustic_failure_gets_one_recorded_recovery_without_resetting_count(self):
        row = self.row()
        self.state(row, reviewed=True, workspace=str(self.root/'work'), voice_attempts=2,
                   voice_terminal=True, failure='The narration has edits that would be heard')
        with patch('prod.completed_voice',return_value=None), \
                patch('prod.voice_film',return_value={'voiced':True,'check_passed':True}) as voice, \
                patch('prod_runtime.export_film',return_value={'exported':True}):
            prod.postprocess(self.config,row,{})
        saved = read_json(self.root/'films'/row['id']/'state.json')
        self.assertEqual(voice.call_count,1)
        self.assertEqual(saved['voice_attempts'],3)
        self.assertEqual(saved['voice_recoveries'][0]['prior_attempts'],2)
        self.assertTrue(saved['exported'])

    def test_current_acoustic_policy_failure_does_not_get_unbounded_recovery(self):
        from prod_voice import POLICY
        row = self.row()
        self.state(row, reviewed=True, workspace=str(self.root/'work'), voice_attempts=2,
                   voice_terminal=True, failure='The narration has edits that would be heard')
        write_json(self.root/'films'/row['id']/'runtime-manifest.json', {'production_voice_policy':POLICY})
        with patch('prod.voice_film') as voice:
            prod.postprocess(self.config,row,{})
        voice.assert_not_called()


class WriterLimitTests(ProductionFixtures):
    def test_anthropic_attempt_cap_is_passed_and_recorded(self):
        process = Mock(pid=12345,returncode=0)
        process.communicate.return_value = (json.dumps({'type':'result','result':'Ready',
            'usage':{'input_tokens':2,'output_tokens':2},'total_cost_usd':.01,'is_error':False}), '')
        with patch('providers.subprocess.Popen',return_value=process) as launch:
            receipt = run_agent('sonnet','study','A bounded task',self.root/'work',
                self.root/'runs/film/study.json',secrets={'ANTHROPIC_API_KEY':'fixture'},max_dollars=20)
        command = launch.call_args.args[0]
        self.assertEqual(command[command.index('--max-budget-usd')+1],'20')
        self.assertEqual(receipt['budget_limit_usd'],20)

    def test_sol_uses_astras_codex_flags_and_account_usage_parser(self):
        stdout = '\n'.join(json.dumps(event) for event in (
            {'type':'item.completed', 'item':{'type':'agent_message','text':'Complete.'}},
            {'type':'turn.completed', 'usage':{'input_tokens':120, 'cached_input_tokens':100, 'output_tokens':8}},
        ))
        process = Mock(pid=12345, returncode=0)
        process.communicate.return_value = (stdout, '')
        with patch('providers.subprocess.Popen', return_value=process) as launch:
            record = run_agent('sol','screenplay','A bounded task',self.root/'work',
                               self.root/'runs/film/screenplay-sol-1.json',check_command='fixture-check')
        command = launch.call_args.args[0]
        self.assertEqual(command[:4], ['codex','exec','-m','gpt-6.1-sol'])
        for argument in ('model_reasoning_effort="xhigh"','mcp_servers={}',
                         '--ignore-user-config','--dangerously-bypass-approvals-and-sandbox',
                         '--skip-git-repo-check','--ephemeral','--json'):
            self.assertIn(argument, command)
        self.assertEqual(record['status'],'succeeded')
        self.assertEqual(record['transport'],'account-cli')
        self.assertIsNone(record['api_dollars'])
        self.assertEqual(record['tokens']['input_uncached'],20)
        self.assertEqual(record['tokens']['input_cached'],100)

    def test_reassignment_is_persisted_and_balances_remaining_writers(self):
        rows = [self.row('first','grok'), self.row('second','grok'),
                self.row('third','sonnet'), self.row('fourth','sol')]
        write_json(self.root/'arms.json', {'assignments': rows})
        write_json(self.root/'provider-limits.json', {'grok': {'reason': 'usage limit'}})
        results = [prod.choose_writer(self.config, row, {}) for row in rows[:2]]
        self.assertCountEqual(results, ['sonnet','sol'])
        persisted = read_json(self.root/'arms.json')['assignments']
        self.assertEqual([r['screenplay'] for r in persisted[:2]], results)
        self.assertTrue(all(r['initial_screenplay']=='grok' for r in persisted[:2]))

    def test_revision_keeps_its_original_writer_even_if_provider_is_limited(self):
        row = self.row(writer='sonnet')
        write_json(self.root/'provider-limits.json', {'grok': {'reason': 'usage limit'}})
        self.assertEqual(prod.choose_writer(self.config, row, {'writer': 'grok'}), 'grok')


class BatchRecoveryTests(ProductionFixtures):
    def test_partial_batch_completion_reuses_remaining_receipt_after_restart(self):
        complete, pending = self.row('complete'), self.row('pending')
        self.state(complete, reviewed=True, review_pending=False)
        self.state(pending, review_pending=True, workspace=str(self.root/'work'))
        item_id = pending['id']+'-review-1'
        write_json(self.root/'review-items'/(item_id+'.json'),
                   {'id': item_id, 'payload':'unused.json', 'images':['unused.jpg']})
        write_json(self.root/'runs'/item_id/'review-fable-1.json', {'status':'succeeded'})
        manifest = self.root/'batches/original-group.json'
        write_json(manifest, {'status':'in_progress','batch_id':'existing'})
        with patch('prod.collect_review_batch', return_value={'status':'collected'}) as collect, \
                patch('prod.submit_review_batch') as submit, \
                patch('prod.stickler', return_value={'ship': True}):
            prod.deferred_reviews(self.config, [complete, pending], {'ANTHROPIC_API_KEY':'fixture'})
        self.assertEqual(collect.call_args.args[0], manifest)
        submit.assert_not_called()
        self.assertTrue(read_json(self.root/'films'/pending['id']/'state.json')['reviewed'])


class StatusTests(ProductionFixtures):
    def test_successful_recovery_keeps_attempt_failures_visible(self):
        row = self.row()
        write_json(self.root/'arms.json', {'grade_order':['K'], 'assignments':[row]})
        self.state(row, exported=True, failures=[{'role':'screenplay'}],
                   voice_history=[{'error':'Clipped ending'}, {'voiced':True}])
        build_status(self.config)
        report = (self.root/'STATUS.md').read_text()
        self.assertIn('1 screenplay, 1 voice failed attempts', report)
        self.assertIn('## Current failures\n\nNone.', report)

    def test_status_uses_live_quota_cap_and_separates_unknown_writer_costs(self):
        row = self.row()
        write_json(self.root/'arms.json', {'grade_order':['K'], 'assignments':[row]})
        self.state(row, written=True, reviewed=True, voice_status='Awaiting voice')
        write_json(self.root/'voice-quota.json', {'initial_remaining':300000,
                   'last_live_remaining':70000, 'reserved_characters':10000})
        write_json(self.root/'runs/example--aa/writer.json', {'role':'screenplay', 'provider':'sol',
                   'transport':'account-cli', 'status':'succeeded', 'wall_seconds':10,
                   'api_dollars':None, 'reported_dollars':None})
        build_status(self.config)
        report = (self.root/'STATUS.md').read_text()
        self.assertIn('holds): 70000;', report)
        self.assertIn('| sol | 1 | 1 | unavailable | 0 | 10.000 | 1 |', report)
        self.assertIn('example--aa: Awaiting voice', report)


if __name__ == '__main__':
    unittest.main()
