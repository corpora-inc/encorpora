"""OAuth scope selection without credentials or network access."""
import contextlib
import io
from pathlib import Path
import runpy
import sys
import tempfile
import types
import unittest
from unittest.mock import Mock, patch


class GoogleAuthTests(unittest.TestCase):
    def test_measurement_scope_is_explicit_and_ads_scope_is_preserved(self):
        for measurement in (False, True):
            with self.subTest(measurement=measurement), tempfile.TemporaryDirectory() as tmp:
                flow = Mock()
                flow.authorization_url.return_value = ("https://example.invalid/private-oauth-state", "private-state")
                installed = Mock()
                installed.from_client_secrets_file.return_value = flow
                module = types.ModuleType("google_auth_oauthlib.flow")
                module.InstalledAppFlow = installed
                output = Path(tmp) / "token.json"
                argv = ["auth-google.py", "--client", "fixture-client.json", "--output", str(output)]
                if measurement:
                    argv.append("--measurement")
                stdout = io.StringIO()
                with patch.dict(sys.modules, {"google_auth_oauthlib.flow": module}), patch.object(sys, "argv", argv), patch("http.server.HTTPServer") as server, contextlib.redirect_stdout(stdout):
                    runpy.run_path(str(Path(__file__).resolve().parents[1] / "auth-google.py"), run_name="__main__")
                expected = ["https://www.googleapis.com/auth/adwords"]
                if measurement:
                    expected.append("https://www.googleapis.com/auth/datamanager")
                self.assertEqual(installed.from_client_secrets_file.call_args.kwargs["scopes"], expected)
                server.assert_called_once()
                self.assertEqual(server.call_args.args[0], ("127.0.0.1", 8769))
                self.assertFalse(output.exists())
                self.assertNotIn("private", stdout.getvalue())

    def test_measurement_callback_requires_actual_grants_before_saving(self):
        ads = "https://www.googleapis.com/auth/adwords"
        measurement = "https://www.googleapis.com/auth/datamanager"
        for grants, accepted in ((None, False), ([ads], False), ([measurement], False),
                                 ([ads, measurement], True), (f"{ads} {measurement}", True)):
            with self.subTest(grants=grants), tempfile.TemporaryDirectory() as tmp:
                flow = Mock()
                flow.authorization_url.return_value = ("https://example.invalid/private-oauth-state", "private-state")
                flow.credentials.granted_scopes = grants
                flow.credentials.scopes = [ads, measurement]
                flow.credentials.to_json.return_value = '{"token":"synthetic-token"}'
                installed = Mock()
                installed.from_client_secrets_file.return_value = flow
                module = types.ModuleType("google_auth_oauthlib.flow")
                module.InstalledAppFlow = installed
                output = Path(tmp) / "token.json"
                argv = ["auth-google.py", "--client", "fixture-client.json", "--output", str(output), "--measurement"]
                stdout = io.StringIO()
                with patch.dict(sys.modules, {"google_auth_oauthlib.flow": module}), patch.object(sys, "argv", argv), patch("http.server.HTTPServer"), patch("threading.Thread"), contextlib.redirect_stdout(stdout):
                    namespace = runpy.run_path(str(Path(__file__).resolve().parents[1] / "auth-google.py"), run_name="__main__")
                    handler = object.__new__(namespace["Handler"])
                    handler.path = "/callback?state=private-state&code=synthetic-code"
                    handler.send_error = Mock()
                    handler.send_response = Mock()
                    handler.end_headers = Mock()
                    handler.wfile = io.BytesIO()
                    handler.server = Mock()
                    handler.do_GET()
                self.assertEqual(output.exists(), accepted)
                if accepted:
                    self.assertEqual(output.stat().st_mode & 0o777, 0o600)
                    handler.send_response.assert_called_once_with(200)
                    handler.send_error.assert_not_called()
                else:
                    handler.send_error.assert_called_once_with(500, "Authorization could not be saved")
                    flow.credentials.to_json.assert_not_called()
                self.assertNotIn("synthetic-token", stdout.getvalue())
                self.assertNotIn("synthetic-code", stdout.getvalue())
                self.assertNotIn("private-state", stdout.getvalue())


if __name__ == "__main__":
    unittest.main()
