"""Read-only report boundaries using actual v26 protobuf messages."""
import contextlib
import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from google.ads.googleads.client import GoogleAdsClient
from google.auth.credentials import AnonymousCredentials
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import campaigns

CID = "1234567890"

class ReportTests(unittest.TestCase):
    def setUp(self):
        self.client = GoogleAdsClient(credentials=AnonymousCredentials(), use_proto_plus=True, version="v26")
        self.account = self.client.get_type("GoogleAdsRow")
        self.account.customer.id = int(CID)
        self.account.customer.currency_code = "USD"
        self.account.customer.time_zone = "America/New_York"
        self.row = self.client.get_type("GoogleAdsRow")
        self.row.campaign.id = 10
        self.row.campaign.name = "AMP | AR | example | abc"
        self.row.campaign.status = "REMOVED"
        self.row.ad_group.id = 20
        self.row.ad_group.name = "efa-math"
        self.row.ad_group.status = "REMOVED"
        self.row.segments.date = "2026-10-01"
        self.row.metrics.cost_micros = 9007199254740993
        self.row.metrics.clicks = 3

    def test_daily_scoped_report_preserves_large_integer_spend_and_context(self):
        with patch.object(campaigns, "rows", side_effect=[[self.account], [self.row]]) as read:
            result = campaigns.report(self.client, CID, "2026-10-01", "2026-10-21")
        query = read.call_args.args[2]
        self.assertIn("FROM ad_group", query)
        self.assertIn("campaign.name LIKE 'AMP | AR | %'", query)
        self.assertIn("segments.date BETWEEN '2026-10-01' AND '2026-10-21'", query)
        self.assertIn("campaign.status IN ('ENABLED','PAUSED','REMOVED')", query)
        self.assertIn("ad_group.status IN ('ENABLED','PAUSED','REMOVED')", query)
        self.assertEqual(result["rows"][0]["metrics"]["cost_micros"], "9007199254740993")
        self.assertEqual(set(result["rows"][0]["metrics"]), {"impressions", "clicks", "cost_micros", "conversions", "conversions_value"})
        self.assertEqual(result["rows"][0]["metrics"]["impressions"], "0")
        self.assertEqual(result["rows"][0]["segments"]["date"], "2026-10-01")
        self.assertEqual(result["rows"][0]["ad_group"]["name"], "efa-math")
        self.assertEqual(result["timezone"], "America/New_York")
        self.assertEqual(result["currency"], "USD")
        self.assertEqual(result["customer_id"], CID)
        self.assertEqual(result["date_range"], {"since":"2026-10-01", "until":"2026-10-21", "inclusive":True})
        self.assertIn("not verified EFA settlement", result["interpretation"])
        self.assertIn("UTC", result["interpretation"])

    def test_invalid_ranges_reject_before_any_platform_call(self):
        cases = [(None, None), ("2026-01-01", None), ("2026-02-30", "2026-03-01"),
                 ("20260101", "2026-01-02"), ("2026-01-02", "2026-01-01"),
                 ("2026-01-01", "2026-04-04"), ("2026-01-01' OR 1=1", "2026-01-02")]
        for start, end in cases:
            with self.subTest(start=start, end=end), patch.object(campaigns, "rows") as read:
                with self.assertRaises(ValueError): campaigns.report(self.client, CID, start, end)
                read.assert_not_called()
        self.assertTrue(campaigns.report_dates("2026-01-01", "2026-04-03")["inclusive"])
        self.assertTrue(campaigns.report_dates("2026-01-01", "2026-01-01")["inclusive"])

    def test_identity_currency_and_time_zone_reject_before_metrics(self):
        for field, value in [("id", 9999999999), ("currency_code", "EUR"), ("time_zone", ""), ("time_zone", "Unknown/Timezone")]:
            account = type(self.account)(self.account)
            setattr(account.customer, field, value)
            with self.subTest(field=field), patch.object(campaigns, "rows", return_value=[account]) as read:
                with self.assertRaises(ValueError): campaigns.report(self.client, CID, "2026-10-01", "2026-10-21")
                self.assertEqual(read.call_count, 1)
        for account in [[], [self.account, self.account]]:
            with patch.object(campaigns, "rows", return_value=account) as read:
                with self.assertRaises(ValueError): campaigns.report(self.client, CID, "2026-10-01", "2026-10-21")
                self.assertEqual(read.call_count, 1)

    def test_empty_report_retains_boundaries_and_unexpected_rows_fail(self):
        with patch.object(campaigns, "rows", side_effect=[[self.account], []]):
            result = campaigns.report(self.client, CID, "2026-10-01", "2026-10-21")
        self.assertEqual(result["rows"], [])
        self.assertIn("Empty rows do not prove", result["interpretation"])
        for field, value in [("name", "Unrelated campaign"), ("date", "2026-09-30"), ("date", "2026-10-22")]:
            row = type(self.row)(self.row)
            setattr(row.campaign if field == "name" else row.segments, field, value)
            with patch.object(campaigns, "rows", side_effect=[[self.account], [row]]):
                with self.assertRaisesRegex(ValueError, "outside"): campaigns.report(self.client, CID, "2026-10-01", "2026-10-21")

    def test_cli_requires_dates_before_reading_config_or_credentials(self):
        for args in [["report", "--config", "absent.json"], ["report", "--since", "2026-10-01"], ["inspect", "--since", "2026-10-01", "--until", "2026-10-02"]]:
            with patch.object(sys, "argv", ["campaigns.py", *args]), patch.object(campaigns, "client_from_config") as auth, contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit): campaigns.main()
                auth.assert_not_called()

    def test_cli_emits_report_envelope(self):
        result = {"rows": [], "timezone": "America/New_York"}
        output = io.StringIO()
        with patch.object(sys, "argv", ["campaigns.py", "report", "--config", "unused.json", "--since", "2026-10-01", "--until", "2026-10-21"]), patch.object(Path, "read_text", return_value=json.dumps({"customer_id":CID})), patch.object(campaigns, "client_from_config", return_value=self.client), patch.object(campaigns, "report", return_value=result) as report, contextlib.redirect_stdout(output):
            campaigns.main()
        report.assert_called_once_with(self.client, CID, "2026-10-01", "2026-10-21")
        self.assertEqual(json.loads(output.getvalue()), result)

if __name__ == "__main__": unittest.main()
