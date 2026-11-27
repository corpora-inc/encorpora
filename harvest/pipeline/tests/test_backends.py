import json
import stat
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from harvest_pipeline.backends import BackendError, Request, Runner, UsageLimitReached, make_backend
from harvest_pipeline.backends.deterministic import ScriptedBackend

SCHEMA = {"type": "object", "required": ["n"], "properties": {"n": {"type": "integer"}}, "additionalProperties": False}
REQ = Request(system="sys", prompt="how many legs", schema=SCHEMA, name="count")


def fake_bin(tmp_path, name, body):
    p = tmp_path / name
    p.write_text("#!/bin/sh\n" + body)
    p.chmod(p.stat().st_mode | stat.S_IEXEC)
    return str(p)


def test_claude_cli_parses_structured_output_and_usage(tmp_path):
    out = {"is_error": False, "structured_output": {"n": 8}, "total_cost_usd": 0.0049,
           "modelUsage": {"claude-sonnet-x": {"inputTokens": 2, "outputTokens": 52, "cacheReadInputTokens": 0,
                                              "cacheCreationInputTokens": 1091}}}
    b = make_backend({"backend": "claude-cli", "model": "sonnet", "workdir": str(tmp_path / "empty"),
                      "binary": fake_bin(tmp_path, "claude", f"cat > {tmp_path}/stdin; echo '{json.dumps(out)}'\n"),
                      "max_week_pct": None})
    r = b.complete(REQ)
    assert r.output == {"n": 8} and r.model_id == "claude-sonnet-x"
    assert r.usage == {"input_tokens": 1093, "output_tokens": 52, "cost_usd": 0.0049}
    assert (tmp_path / "stdin").read_text() == "how many legs"
    cmd = b.command(REQ)
    for flag in ("--setting-sources", "--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence",
                 "--json-schema", "--tools"):
        assert flag in cmd
    assert b.spec == "claude-cli:sonnet"


def test_claude_cli_error_and_guard(tmp_path):
    b = make_backend({"backend": "claude-cli", "binary": fake_bin(tmp_path, "c", "echo '{\"is_error\": true, \"result\": \"boom\"}'\n"),
                      "workdir": str(tmp_path), "max_week_pct": 60,
                      "rate_limits_file": str(tmp_path / "rl.json")})
    with pytest.raises(BackendError):
        b.complete(REQ)
    (tmp_path / "rl.json").write_text(json.dumps({"seven_day": {"used_percentage": 61}}))
    with pytest.raises(UsageLimitReached):
        Runner(b, sleep=lambda s: None).call(REQ)


def test_runner_retries_on_schema_mismatch_then_succeeds():
    replies = iter([{"n": "eight"}, {"n": 8}])
    b = ScriptedBackend(responses=lambda req: next(replies))
    r = Runner(b, retries=2, sleep=lambda s: None)
    assert r.call(REQ).output == {"n": 8}
    assert r.usage.calls == 1 and r.usage.retries == 1 and r.usage.failures == 1


def test_runner_gives_up_on_non_retryable():
    b = ScriptedBackend(responses={})
    with pytest.raises(BackendError):
        Runner(b, sleep=lambda s: None).call(REQ)


class _Handler(BaseHTTPRequestHandler):
    seen = []

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        _Handler.seen.append(body)
        if "tools" in body:
            msg = {"role": "assistant", "content": None,
                   "tool_calls": [{"function": {"name": "count", "arguments": "{\"n\": 6}"}}]}
        else:
            msg = {"role": "assistant", "content": "{\"n\": 8}"}
        data = json.dumps({"model": "gpt-oss-120b-test", "choices": [{"message": msg, "finish_reason": "stop"}],
                           "usage": {"prompt_tokens": 11, "completion_tokens": 3}}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


@pytest.fixture
def server():
    s = HTTPServer(("127.0.0.1", 0), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()
    yield f"http://127.0.0.1:{s.server_address[1]}/v1"
    s.shutdown()


def test_openai_compatible_json_schema_and_tools(server):
    b = make_backend({"backend": "openai-compatible", "model": "gpt-oss-120b", "base_url": server})
    r = b.complete(REQ)
    assert r.output == {"n": 8} and r.model_id == "gpt-oss-120b-test" and r.usage["input_tokens"] == 11
    body = _Handler.seen[-1]
    assert body["response_format"]["json_schema"]["schema"] == SCHEMA
    t = make_backend({"backend": "openai-compatible", "model": "m", "base_url": server, "mode": "tools"})
    assert t.complete(REQ).output == {"n": 6}
    assert _Handler.seen[-1]["tool_choice"]["function"]["name"] == "count"


def test_codex_reads_output_file(tmp_path):
    script = ('while [ "$1" != "" ]; do if [ "$1" = "-o" ]; then shift; OUT=$1; fi; shift; done\n'
              'cat > /dev/null; echo \'{"n": 3}\' > "$OUT"\n')
    b = make_backend({"backend": "codex", "binary": fake_bin(tmp_path, "codex", script), "workdir": str(tmp_path)})
    assert b.complete(REQ).output == {"n": 3}


def test_anthropic_backend_with_injected_client():
    class Block:
        type = "text"
        text = "{\"n\": 4}"

    class Msg:
        content = [Block()]
        stop_reason = "end_turn"
        model = "claude-sonnet-5-5"
        class usage:  # noqa: N801
            input_tokens = 1000
            output_tokens = 100

    class Client:
        class messages:  # noqa: N801
            @staticmethod
            def create(**kw):
                assert kw["output_config"]["format"]["schema"] == SCHEMA
                return Msg()

    b = make_backend({"backend": "anthropic", "client": Client()})
    r = b.complete(REQ)
    assert r.output == {"n": 4} and r.usage["cost_usd"] == pytest.approx((1000 * 2 + 100 * 10) / 1e6)
