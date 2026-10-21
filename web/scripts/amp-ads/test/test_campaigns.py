"""Regression checks for delivery controls and uncertain-write recovery."""

import copy
import json
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import patch

from google.ads.googleads.client import GoogleAdsClient
from google.auth.credentials import AnonymousCredentials

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import campaigns

SPEC = json.loads(
    (Path(__file__).resolve().parents[1] / "examples/search.json").read_text()
)
CID = "1234567890"
RESOURCE = f"customers/{CID}/campaigns/1"


class FakeClient:
    def __init__(self, fail_write=False):
        self.sdk = GoogleAdsClient(
            credentials=AnonymousCredentials(), use_proto_plus=True, version="v26"
        )
        self.calls = []
        self.fail_write = fail_write

    def get_type(self, name):
        return self.sdk.get_type(name)

    def get_service(self, name):
        return self

    def mutate(self, request):
        self.calls.append(type(request)(request))
        if self.fail_write and not request.validate_only:
            raise TimeoutError("Uncertain network outcome")


class CampaignTests(unittest.TestCase):
    def test_delivery_and_geo_controls_in_real_sdk_request(self):
        client = FakeClient()
        ops = campaigns.build_operations(SPEC, CID, "geoTargetConstants/21135")
        messages = [type(client.get_type("MutateOperation"))(**op) for op in ops]
        campaign = messages[1].campaign_operation.create
        self.assertEqual(campaign.status.name, "PAUSED")
        self.assertEqual(
            campaign.geo_target_type_setting.positive_geo_target_type.name, "PRESENCE"
        )
        self.assertFalse(campaign.network_settings.target_search_network)
        self.assertFalse(campaign.network_settings.target_content_network)
        for op in ops:
            for key in ["ad_group_operation", "ad_group_ad_operation"]:
                if key in op:
                    self.assertEqual(op[key]["create"]["status"], "PAUSED")
        self.assertEqual(
            messages[
                2
            ].campaign_criterion_operation.create.location.geo_target_constant,
            "geoTargetConstants/21135",
        )

    def test_rejects_enabled_and_wrong_destination(self):
        for update in [
            {"status": "ENABLED"},
            {"state": "Texas"},
            {"daily_budget_micros": True},
        ]:
            with self.assertRaises(ValueError):
                campaigns.validate({**copy.deepcopy(SPEC), **update})
        for url in [
            "http://corpora.inc",
            "https://corpora.inc.evil.test",
            "https://x@corpora.inc",
        ]:
            s = copy.deepcopy(SPEC)
            s["ad_groups"][0]["url"] = url
            with self.assertRaises(ValueError):
                campaigns.validate(s)
        s = copy.deepcopy(SPEC)
        s["ad_groups"][0]["headlines"][0] = "x" * 31
        with self.assertRaises(ValueError):
            campaigns.validate(s)

    def test_validate_only_never_writes(self):
        c = FakeClient()
        with patch.object(
            campaigns,
            "rows",
            side_effect=[
                [],
                [],
                [NS(geo_target_constant=NS(resource_name="geoTargetConstants/21135"))],
            ],
        ):
            result = campaigns.apply(c, CID, SPEC, validate_only=True)
        self.assertFalse(result["created"])
        self.assertEqual(len(c.calls), 1)
        self.assertTrue(c.calls[0].validate_only)
        self.assertFalse(c.calls[0].partial_failure)

    def test_timeout_is_not_retried(self):
        c = FakeClient(fail_write=True)
        with (
            patch.object(
                campaigns,
                "rows",
                side_effect=[
                    [],
                    [],
                    [
                        NS(
                            geo_target_constant=NS(
                                resource_name="geoTargetConstants/21135"
                            )
                        )
                    ],
                ],
            ),
            self.assertRaises(TimeoutError),
        ):
            campaigns.apply(c, CID, SPEC)
        self.assertEqual([r.validate_only for r in c.calls], [True, False])

    def test_existing_campaign_is_read_and_never_recreated(self):
        c = FakeClient()
        existing = NS(campaign=NS(resource_name=RESOURCE, status=NS(name="PAUSED")))
        with (
            patch.object(campaigns, "rows", return_value=[existing]),
            patch.object(campaigns, "verify_paused") as verify,
        ):
            result = campaigns.apply(c, CID, SPEC)
        verify.assert_called_once_with(c, CID, SPEC, RESOURCE)
        self.assertFalse(result["created"])
        self.assertEqual(c.calls, [])

    def test_readback_detects_delivery_and_copy_drift(self):
        def snapshot():
            group = SPEC["ad_groups"][0]
            campaign = NS(
                status=NS(name="PAUSED"),
                advertising_channel_type=NS(name="SEARCH"),
                bidding_strategy_type=NS(name="MANUAL_CPC"),
                geo_target_type_setting=NS(
                    positive_geo_target_type=NS(name="PRESENCE")
                ),
                network_settings=NS(
                    target_google_search=True,
                    target_search_network=False,
                    target_content_network=False,
                    target_partner_search_network=False,
                ),
            )
            row = NS(
                campaign=campaign,
                campaign_budget=NS(amount_micros=SPEC["daily_budget_micros"]),
            )
            groups = [
                NS(
                    ad_group=NS(
                        name=group["id"],
                        status=NS(name="PAUSED"),
                        cpc_bid_micros=SPEC["max_cpc_micros"],
                    )
                )
            ]
            ads = [
                NS(
                    ad_group=NS(name=group["id"]),
                    ad_group_ad=NS(
                        status=NS(name="PAUSED"),
                        ad=NS(
                            final_urls=[group["url"]],
                            responsive_search_ad=NS(
                                headlines=[NS(text=x) for x in group["headlines"]],
                                descriptions=[
                                    NS(text=x) for x in group["descriptions"]
                                ],
                            ),
                        ),
                    ),
                )
            ]
            return [[row], groups, ads]

        with patch.object(campaigns, "rows", side_effect=snapshot()):
            campaigns.verify_paused(FakeClient(), CID, SPEC, RESOURCE)
        for kind in ["network", "budget", "group", "ad", "copy"]:
            states = snapshot()
            if kind == "network":
                states[0][0].campaign.network_settings.target_content_network = True
            if kind == "budget":
                states[0][0].campaign_budget.amount_micros += 1
            if kind == "group":
                states[1][0].ad_group.status.name = "ENABLED"
            if kind == "ad":
                states[2][0].ad_group_ad.status.name = "ENABLED"
            if kind == "copy":
                states[2][0].ad_group_ad.ad.responsive_search_ad.headlines[
                    0
                ].text = "Changed"
            with (
                patch.object(campaigns, "rows", side_effect=states),
                self.assertRaises(ValueError),
            ):
                campaigns.verify_paused(FakeClient(), CID, SPEC, RESOURCE)

    def test_other_revision_and_active_campaign_refuse(self):
        for responses in [[[], [NS()]], [[NS(campaign=NS(status=NS(name="ENABLED")))]]]:
            c = FakeClient()
            with (
                patch.object(campaigns, "rows", side_effect=responses),
                self.assertRaises(ValueError),
            ):
                campaigns.apply(c, CID, SPEC)
            self.assertEqual(c.calls, [])


if __name__ == "__main__":
    unittest.main()
