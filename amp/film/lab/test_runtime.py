import json
from pathlib import Path
import tempfile
import unittest

from runtime import prepare_workspace, validate_cast, verify_runtime


class RuntimeBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        amp = self.base/'worktree/amp'
        files = ['film/AUTHORING.md', 'film/schema.ts', 'film/design/PROCESS.md',
                 'film/design/KAIZEN.md', 'film/design/CURRICULUM.md', 'film/design/example/FAMILY.md',
                 'film/lessons/rectangle-area.json', 'film/lessons/line-slope.json',
                 'film/lessons/fraction-line-position.json', 'film/lessons/two-step-word-problem.json',
                 'browser-security.mjs', 'package.json']
        for name in files:
            path = amp/name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('{}')
        (amp/'film/make.ts').write_text('const suffix = values.tall ? "-tall" : "";\nconst config = { server: { host: "127.0.0.1", port: 0 } };')
        (amp/'src').mkdir()
        (amp/'node_modules').mkdir()
        self.config = {'root': str(self.base/'private'), 'worktree': str(self.base/'worktree'),
                       'workspace_root': str(self.base/'worktree/amp/film/lab/.work')}
        self.row = {'id': 'example--aa', 'family_path': 'example/FAMILY.md'}

    def test_check_runtime_cannot_be_changed_by_the_writer(self):
        workspace = prepare_workspace(self.config, self.row, {'standards': []}, 'study')
        target = workspace/'runtime/amp/film/make.ts'
        target.write_text(target.read_text()+'\n// unauthorized change')
        with self.assertRaisesRegex(RuntimeError, 'modified the kit'):
            verify_runtime(self.config, self.row, workspace)

    def test_changed_input_cannot_enter_a_retry(self):
        prepare_workspace(self.config, self.row, {'standards': []}, 'study')
        with self.assertRaisesRegex(RuntimeError, 'immutable workspace input changed'):
            prepare_workspace(self.config, self.row, {'standards': ['changed']}, 'study')

    def test_writer_cannot_change_shared_figures_through_the_runtime_link(self):
        workspace = prepare_workspace(self.config, self.row, {'standards': []}, 'study')
        (workspace/'runtime/amp/src/figure.ts').write_text('export const altered = true;')
        with self.assertRaisesRegex(RuntimeError, 'Shared app source changed'):
            verify_runtime(self.config, self.row, workspace)
        next_row = {**self.row, 'id': 'another--bb'}
        with self.assertRaisesRegex(RuntimeError, 'Shared app source changed'):
            prepare_workspace(self.config, next_row, {'standards': []}, 'study')

    def test_voice_bindings_and_model_attribution_are_not_screenplay_fields(self):
        path = self.base/'script.json'
        script = {'id': 'example--aa', 'title': 'Adding', 'cast': {'teacher': {}, 'learner': {}},
                  'shots': [{'beats': [{'speaker': 'teacher', 'say': 'Count the dots.'},
                                       {'speaker': 'learner', 'say': 'I count four.'}]}]}
        path.write_text(json.dumps(script))
        validate_cast(path, 'example--aa')
        script['cast']['teacher'] = {'voice': 'a-voice'}
        path.write_text(json.dumps(script))
        with self.assertRaisesRegex(ValueError, 'empty voice bindings'):
            validate_cast(path, 'example--aa')
        script['cast']['teacher'] = {}
        script['title'] = 'Written by Grok'
        path.write_text(json.dumps(script))
        with self.assertRaisesRegex(ValueError, 'attribution'):
            validate_cast(path, 'example--aa')


if __name__ == '__main__':
    unittest.main()
