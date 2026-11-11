import json
from pathlib import Path
import tempfile
import unittest

from providers import api_cost, claude_output, credentials, grok_output, normalized_usage, redact


class EvidenceTests(unittest.TestCase):
    def test_grok_closing_event_without_usage_preserves_response_boundaries(self):
        boundary = {'type': 'usage', 'messageId': 'one',
                    'usage': {'input_tokens': 20, 'output_tokens': 30}}
        for kind in ('end', 'error'):
            for closing_usage in ({}, {'usage': {}}):
                with self.subTest(kind=kind, closing_usage=closing_usage):
                    final = {'type': kind, **closing_usage}
                    result = grok_output(json.dumps(boundary)+'\n'+json.dumps(final))
                    self.assertEqual(result['usage']['input_tokens'], 20)
                    self.assertEqual(result['usage']['output_tokens'], 30)
                    self.assertTrue(result['usage_partial'])
                    self.assertNotIn('total_cost_usd', result)

    def test_grok_stream_preserves_partial_tokens_without_inventing_dollars(self):
        boundary = {'type': 'usage', 'messageId': 'one', 'usage': {
            'input_tokens': 20, 'cache_read_input_tokens': 100, 'output_tokens': 30}}
        events = [{'type': 'text', 'data': 'Progress.'}, boundary, boundary,
                  {'type': 'text', 'data': '{"ship":true}'},
                  {'type': 'end', 'stopReason': 'cancelled', 'usage_is_incomplete': True,
                   'usage': {}, 'total_cost_usd': 0}]
        partial = grok_output('\n'.join(json.dumps(e) for e in events))
        self.assertEqual(partial['text'], 'Progress.{"ship":true}')
        self.assertEqual(partial['usage']['input_tokens'], 20)
        self.assertEqual(partial['usage']['cache_read_input_tokens'], 100)
        self.assertEqual(partial['reported_requests'], 1)
        self.assertTrue(partial['usage_partial'])
        self.assertTrue(partial['is_error'])
        self.assertNotIn('total_cost_usd', partial)
        events[-1] = {'type': 'end', 'stopReason': 'end_turn', 'usage': {
            'input_tokens': 40, 'output_tokens': 50}, 'total_cost_usd': .25}
        complete = grok_output('\n'.join(json.dumps(e) for e in events))
        self.assertEqual(complete['usage']['input_tokens'], 40)
        self.assertEqual(complete['total_cost_usd'], .25)
        self.assertFalse(complete['usage_partial'])
        self.assertFalse(complete['is_error'])


    def test_api_key_file_is_parsed_not_executed(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'env'
            path.write_text('export ANTHROPIC_API_KEY="test-key" # comment\nUNRELATED_SECRET=ignore\n')
            self.assertEqual(credentials(path), {'ANTHROPIC_API_KEY': 'test-key'})
        self.assertEqual(redact('error test-key', {'key': 'test-key'}), 'error [REDACTED]')

    def test_cached_tokens_are_not_counted_twice(self):
        astra = normalized_usage('astra', {'input_tokens': 120, 'cached_input_tokens': 100, 'output_tokens': 4})
        claude = normalized_usage('fable', {'input_tokens': 20, 'cache_read_input_tokens': 100, 'output_tokens': 4})
        self.assertEqual(astra['input_uncached'], claude['input_uncached'])
        self.assertEqual(astra['input_cached'], claude['input_cached'])
        self.assertIsNone(normalized_usage('astra', {})['input_uncached'])

    def test_prices_use_cache_lifetimes(self):
        usage = {'input_tokens': 1000, 'output_tokens': 100,
                 'cache_read_input_tokens': 2000, 'cache_creation_input_tokens': 300,
                 'cache_creation': {'ephemeral_5m_input_tokens': 200, 'ephemeral_1h_input_tokens': 100}}
        self.assertAlmostEqual(api_cost('fable', usage), .016)

    def test_interrupted_stream_deduplicates_inputs_and_ignores_placeholder_outputs(self):
        message = {'id': 'request-one', 'usage': {'input_tokens': 20,
                   'cache_read_input_tokens': 100, 'output_tokens': 1}}
        events = [
            {'type': 'stream_event', 'event': {'type': 'message_start', 'message': message}},
            {'type': 'assistant', 'message': message},
            {'type': 'assistant', 'message': message},
            {'type': 'stream_event', 'event': {'type': 'message_delta', 'usage': {'output_tokens': 40}}},
            {'type': 'stream_event', 'event': {'type': 'message_stop'}},
            {'type': 'stream_event', 'event': {'type': 'message_start', 'message': {
                'id': 'request-two', 'usage': {'input_tokens': 10, 'output_tokens': 1}}}},
        ]
        stream = '\n'.join(json.dumps(e) for e in events)+'\n{"type":'
        result = claude_output(stream, 'fable')
        self.assertTrue(result['usage_partial'])
        self.assertTrue(result['is_error'])
        self.assertEqual(result['reported_requests'], 2)
        self.assertEqual(result['usage'], {'input_tokens': 30, 'output_tokens': 40, 'cache_read_input_tokens': 100})
        self.assertAlmostEqual(result['partial_api_dollars'], .00186)
        self.assertEqual(result['malformed_stream_lines'], 1)

    def test_final_result_overrides_partial_stream_but_zeroed_crash_does_not(self):
        event = {'type': 'assistant', 'message': {'id': 'request-one',
                 'usage': {'input_tokens': 100, 'output_tokens': 1}}}
        final = {'type': 'result', 'result': 'Finished.', 'usage': {'input_tokens': 100, 'output_tokens': 200},
                 'total_cost_usd': .75, 'is_error': False}
        stream = json.dumps(event)+'\n'+json.dumps(final)
        result = claude_output(stream, 'sonnet')
        self.assertFalse(result['usage_partial'])
        self.assertEqual(result['usage']['output_tokens'], 200)
        self.assertEqual(result['total_cost_usd'], .75)
        final.update(subtype='error_during_execution', total_cost_usd=0, usage={})
        partial = claude_output(json.dumps(event)+'\n'+json.dumps(final), 'sonnet')
        self.assertTrue(partial['usage_partial'])
        self.assertNotIn('output_tokens', partial['usage'])
        self.assertAlmostEqual(partial['partial_api_dollars'], .0002)


if __name__ == '__main__':
    unittest.main()
