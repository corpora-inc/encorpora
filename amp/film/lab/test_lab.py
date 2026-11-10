import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

from lab import append_coverage, postprocess, production
from providers import write_json

VALID_STUDY = 'A learner card.\n```coverage-json\n{"verdict":"sampled","sample_limits":"ten examples","gaps":[]}\n```'


class ProductionBudgetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        base = Path(self.temp.name)
        self.root, self.worktree = base/'private', base/'worktree'
        family = self.worktree/'amp/film/design/family.md'
        family.parent.mkdir(parents=True)
        family.write_text('Family proposal.')
        write_json(self.root/'facts/example.json', {'standards': []})
        self.config = {'root': str(self.root), 'worktree': str(self.worktree),
                       'workspace_root': str(self.worktree/'workspace')}
        self.row = {'id': 'example-aa', 'type': 'example', 'family_path': 'family.md',
                    'study': 'sonnet', 'screenplay': 'sonnet'}
        self.workspace = self.worktree/'workspace/example-aa'
        self.workspace.mkdir(parents=True)
        (self.workspace/'screenplay.json').write_text('{}')
        runtime = types.SimpleNamespace(prepare_workspace=lambda *a: self.workspace,
            check_command=lambda *a: 'check-fixture', check_film=lambda *a: {'passed': True})
        self.runtime_patch = patch.dict('sys.modules', {'runtime': runtime})
        self.runtime_patch.start()
        self.addCleanup(self.runtime_patch.stop)

    def test_failure_limit_spans_study_and_screenplay_and_survives_restart(self):
        write_json(self.root/'runs/example-aa/study-sonnet-1.json',
                   {'status': 'succeeded', 'response': 'malformed study'})
        def fake(provider, role, prompt, workspace, receipt, **kwargs):
            record = {'status': 'succeeded', 'response': VALID_STUDY} if role=='study' else {
                'status': 'failed', 'response': '', 'error': 'writer failure'}
            write_json(receipt, record)
            return record
        with patch('lab.run_agent', side_effect=fake) as model:
            production(self.config, self.row, {})
            production(self.config, self.row, {})
            self.assertEqual(model.call_count, 2)
        state = json.loads((self.root/'films/example-aa/state.json').read_text())
        self.assertEqual(state['status'], 'failed')
        self.assertEqual(len(state['failures']), 2)
        self.assertFalse((self.root/'runs/example-aa/screenplay-sonnet-2.json').exists())

    def test_completed_study_receipt_survives_missing_checkpoint(self):
        write_json(self.root/'runs/example-aa/study-sonnet-1.json',
                   {'status': 'succeeded', 'response': VALID_STUDY})
        def fake(provider, role, prompt, workspace, receipt, **kwargs):
            self.assertEqual(role, 'screenplay')
            record = {'status': 'succeeded', 'response': 'Checked.'}
            write_json(receipt, record)
            return record
        with patch('lab.run_agent', side_effect=fake) as model:
            production(self.config, self.row, {})
            self.assertEqual(model.call_count, 1)
        state = json.loads((self.root/'films/example-aa/state.json').read_text())
        self.assertTrue(state['checked'])

    def test_unquoted_standard_claim_never_enters_gap_queue(self):
        facts = {'standards': [{'code': 'S.1', 'text': 'Explain the reasoning.'}]}
        gap = {'standard': 'S.1', 'clause': 'Prove every theorem.', 'evidence': 'sample',
               'gap': 'Missing proof.', 'scope': 'type', 'proposed_action': 'Audit.'}
        with self.assertRaisesRegex(ValueError, 'verbatim'):
            append_coverage(self.root, self.row, facts, {'gaps': [gap]})
        self.assertFalse((self.root/'coverage-gaps.jsonl').exists())


class VoiceRecoveryTests(unittest.TestCase):
    def test_interruption_after_second_attempt_cannot_create_a_third_charge(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            row = {'id': 'example--aa'}
            write_json(root/'films/example--aa/state.json', {'checked': True, 'workspace': directory, 'voice_attempts': 2})
            def forbidden(*_):
                self.fail('A third voice attempt must not run')
            runtime = types.SimpleNamespace(completed_voice=lambda *_: None, voice_film=forbidden,
                export_film=forbidden, make_review_item=lambda *_, **kwargs: {'id': row['id'], 'voiced': kwargs['voiced']})
            with patch.dict('sys.modules', {'runtime': runtime}):
                item = postprocess({'root': directory}, row, {})
            self.assertFalse(item['voiced'])
            state = json.loads((root/'films/example--aa/state.json').read_text())
            self.assertTrue(state['voice_terminal'])
            self.assertEqual(state['voice_attempts'], 2)

    def test_transient_retry_finishes_before_review_input_is_frozen(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            row = {'id': 'example--aa'}
            write_json(root/'films/example--aa/state.json', {'checked': True, 'workspace': directory})
            voice_calls = []
            def voice(*_):
                voice_calls.append(1)
                return {'voiced': True} if len(voice_calls)==2 else {'voiced': False, 'error': 'Transient service failure'}
            def review(*_, voiced):
                self.assertTrue(voiced)
                self.assertEqual(len(voice_calls), 2)
                return {'id': row['id'], 'payload': 'frozen-voiced-payload'}
            runtime = types.SimpleNamespace(completed_voice=lambda *_: None, voice_film=voice,
                export_film=lambda *_: {'exported': True}, make_review_item=review)
            with patch.dict('sys.modules', {'runtime': runtime}):
                postprocess({'root': directory}, row, {})
                postprocess({'root': directory}, row, {})
            self.assertEqual(len(voice_calls), 2)
            state = json.loads((root/'films/example--aa/state.json').read_text())
            self.assertEqual(state['voice_attempts'], 2)
            self.assertTrue(state['voiced'])


if __name__ == '__main__':
    unittest.main()
